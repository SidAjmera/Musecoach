import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { defaultProfile } from "../../lib/types";

function wav() {
  const rate = 16000,
    seconds = 16,
    buffer = Buffer.alloc(44 + rate * seconds * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(buffer.length - 44, 40);
  for (let i = 0; i < rate * seconds; i++)
    buffer.writeInt16LE(
      Math.round(6000 * Math.sin((2 * Math.PI * 220 * i) / rate)),
      44 + i * 2,
    );
  return { name: "backup-fixture.wav", mimeType: "audio/wav", buffer };
}
async function record(page: Page, title: string, save: boolean) {
  await page.goto("/record");
  await page.getByLabel("Upload an audio file").setInputFiles(wav());
  await page.getByLabel("Session name", { exact: true }).fill(title);
  if (save) await page.getByLabel("Save audio in this browser").check();
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText("100");
}
async function openBackup(page: Page) {
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  const region = page.getByRole("region", {
    name: "Back up or restore history",
  });
  await region.getByText("Back up or restore history", { exact: true }).click();
  return region;
}

test("history backup moves measured reviews to another browser and preserves existing audio on merge", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(
    (profile) => {
      localStorage.setItem("musecoach-profile", JSON.stringify(profile));
      localStorage.setItem(
        "musecoach-ai-connection",
        JSON.stringify({
          provider: "gemini",
          key: "private-backup-key-fixture",
          model: "",
          remembered: true,
        }),
      );
      localStorage.setItem(
        "musecoach-chat",
        JSON.stringify([{ role: "user", content: "private-chat-fixture" }]),
      );
    },
    { ...defaultProfile, name: "BackupSinger" },
  );
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") posts++;
  });
  await record(page, "Backup take one", true);
  await record(page, "Backup take two", false);
  const region = await openBackup(page);
  const event = page.waitForEvent("download");
  await region
    .getByRole("button", { name: "Download history backup", exact: true })
    .click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/^musecoach-backup-.*\.json$/);
  const json = readFileSync((await download.path())!, "utf8");
  expect(json).not.toMatch(/private-backup-key-fixture|private-chat-fixture/);
  const data = JSON.parse(json);
  expect(data.sessions).toHaveLength(2);
  expect(
    data.sessions.every((s: { audioSaved: boolean }) => s.audioSaved === false),
  ).toBe(true);

  const migrated = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize() || undefined,
    isMobile: testInfo.project.name === "mobile",
    hasTouch: testInfo.project.name === "mobile",
  });
  try {
    const other = await migrated.newPage();
    other.on("request", (request) => {
      if (request.method() === "POST") posts++;
    });
    await other.goto("/progress");
    const target = other.getByRole("region", {
      name: "Back up or restore history",
    });
    await target
      .getByText("Back up or restore history", { exact: true })
      .click();
    await target
      .getByLabel("Choose a history backup to preview", { exact: true })
      .setInputFiles({
        name: "history.json",
        mimeType: "application/json",
        buffer: Buffer.from(json),
      });
    await expect(
      target.getByText(/2 sessions in this backup · 2 new · 0 already here/),
    ).toBeVisible();
    await expect(
      other.getByRole("link", { name: /Backup take one/ }),
    ).toHaveCount(0);
    await expect(
      target.getByLabel(/Use the profile from this backup/),
    ).not.toBeChecked();
    await target.getByLabel(/Use the profile from this backup/).check();
    const accessibility = await new AxeBuilder({ page: other })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await other
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .click();
    const dark = await new AxeBuilder({ page: other })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      dark.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await other.screenshot({
      path: `artifacts/history-backup-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await target
      .getByRole("button", { name: "Restore this backup", exact: true })
      .click();
    await expect(target.getByRole("status")).toContainText(
      "Restored 2 sessions",
    );
    expect(
      await other.evaluate(() =>
        localStorage.getItem("musecoach-ai-connection"),
      ),
    ).toBeNull();
    expect(
      await other.evaluate(
        () => JSON.parse(localStorage.getItem("musecoach-profile")!).name,
      ),
    ).toBe("BackupSinger");
    await other.getByRole("link", { name: /Backup take one/ }).click();
    await expect(other.locator(".score-circle strong")).toHaveText("100");
    await expect(other.getByText(/Restored from your backup/)).toBeVisible();
    await expect(
      other.getByText(/Audio wasn’t saved with this session/),
    ).toBeVisible();
    expect(
      await other.locator(".pitch-chart svg path").getAttribute("d"),
    ).toMatch(/L/);
    await other.reload();
    await expect(other.locator(".score-circle strong")).toHaveText("100");
  } finally {
    await migrated.close();
  }

  const original = data.sessions.find(
    (s: { title: string }) => s.title === "Backup take one",
  );
  data.sessions.push({
    ...original,
    id: "new-restore-fixture",
    title: "New restored take",
  });
  await region
    .getByLabel("Choose a history backup to preview", { exact: true })
    .setInputFiles({
      name: "merge.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await expect(
    region.getByText(/3 sessions in this backup · 1 new · 2 already here/),
  ).toBeVisible();
  await region
    .getByRole("button", { name: "Restore this backup", exact: true })
    .click();
  await expect(region.getByRole("status")).toContainText(
    "Restored 1 session. Kept 2 existing sessions",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("musecoach-ai-connection")!).key,
    ),
  ).toBe("private-backup-key-fixture");
  await page.getByRole("link", { name: /Backup take one/ }).click();
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  const again = await openBackup(page);
  await again
    .getByLabel("Choose a history backup to preview", { exact: true })
    .setInputFiles({
      name: "merge.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await expect(
    again.getByRole("button", { name: "Restore this backup", exact: true }),
  ).toBeDisabled();
  expect(posts).toBe(0);
});

test("invalid backup preview cannot alter local history or profile", async ({
  page,
}) => {
  await page.goto("/progress");
  const region = page.getByRole("region", {
    name: "Back up or restore history",
  });
  await region.getByText("Back up or restore history", { exact: true }).click();
  await region
    .getByLabel("Choose a history backup to preview", { exact: true })
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"apiKey":"untrusted-fixture"}'),
    });
  await expect(region.getByRole("alert")).toContainText(
    "not a supported Musecoach backup",
  );
  await expect(
    region.getByRole("button", { name: "Restore this backup", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download progress CSV", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("musecoach-profile")),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("musecoach-ai-connection")),
  ).toBeNull();
});

test("session notes and renaming preserve audio and measured results without sharing notes with AI", async ({
  page,
}) => {
  await record(page, "Before notes", true);
  const sessionId = page.url().split("/").pop()!;
  await page
    .getByText("Rename this take or add practice notes", { exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Session name and private notes",
  });
  await editor
    .getByLabel("Session title", { exact: true })
    .fill("Focused vowel");
  const note = "Private note: gentle entry, then leave a gap.";
  await editor.getByLabel("Private practice notes", { exact: true }).fill(note);
  await editor
    .getByRole("button", { name: "Save session notes", exact: true })
    .click();
  await expect(editor.getByRole("status")).toContainText(
    "audio and measurements were kept",
  );
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator(".score-circle strong")).toHaveText("100");
  await page.reload();
  await page
    .getByText("Rename this take or add practice notes", { exact: true })
    .click();
  await expect(editor.getByLabel("Session title", { exact: true })).toHaveValue(
    "Focused vowel",
  );
  await expect(
    editor.getByLabel("Private practice notes", { exact: true }),
  ).toHaveValue(note);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  const darkNotes = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    darkNotes.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const backup = await openBackup(page);
  const downloaded = page.waitForEvent("download");
  await backup
    .getByRole("button", { name: "Download history backup", exact: true })
    .click();
  const payload = JSON.parse(
    readFileSync((await (await downloaded).path())!, "utf8"),
  );
  expect(payload.sessions).toHaveLength(1);
  expect(payload.sessions[0]).toMatchObject({
    id: sessionId,
    title: "Focused vowel",
    notes: note,
  });
  expect(payload.sessions[0].analysis.score).toBe(100);
  await page.route("**/api/coach", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { providers: [{ id: "gemini", label: "Gemini" }] },
      });
    expect(route.request().postData()).not.toContain(note);
    return route.fulfill({
      json: { reply: "Try the measured held-note exercise." },
    });
  });
  await page.getByRole("link", { name: "My Coach", exact: true }).click();
  await page
    .getByLabel("API key", { exact: true })
    .fill("notes-privacy-fixture");
  await page
    .getByRole("button", { name: "Save AI connection", exact: true })
    .click();
  await page
    .getByLabel("Ask about your results or practice")
    .fill("What should I try next?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Try the measured held-note exercise.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/session/${sessionId}`);
  await page
    .getByRole("button", { name: "Reanalyse saved audio", exact: true })
    .click();
  await expect(
    page.getByText(/Updated this take with the latest detector/),
  ).toBeVisible();
  await page
    .getByText("Rename this take or add practice notes", { exact: true })
    .click();
  await expect(
    editor.getByLabel("Private practice notes", { exact: true }),
  ).toHaveValue(note);
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
});
