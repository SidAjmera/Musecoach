import { expect, test } from "@playwright/test";
import { midiHz } from "../../lib/exercises";
import { defaultProfile } from "../../lib/types";
import AxeBuilder from "@axe-core/playwright";

const design = {
  name: "Theo’s timing steps",
  rationale:
    "Use small steps and clear gaps to practise the entries in your recent pointers.",
  targets: [60, 62, 60, 64].map((midi, i) => ({
    midi,
    start: 3 + i * 3,
    duration: 2,
  })),
};
function targetWav() {
  const rate = 16000,
    seconds = 18,
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
  for (let i = 0; i < rate * seconds; i++) {
    const time = i / rate,
      target = design.targets.find(
        (t) => time >= t.start && time < t.start + t.duration,
      );
    buffer.writeInt16LE(
      target
        ? Math.round(6000 * Math.sin(2 * Math.PI * midiHz(target.midi) * time))
        : 0,
      44 + i * 2,
    );
  }
  return { name: "designed-targets.wav", mimeType: "audio/wav", buffer };
}
test("AI exercise design offers a key, respects decline, and scores a validated personal reference", async ({
  page,
}, testInfo) => {
  let requests = 0;
  await page.route("**/api/exercise", async (route) => {
    requests++;
    const request = route.request().postDataJSON();
    expect(request.ai.key).toBe("visitor-design-fixture");
    expect(request).not.toHaveProperty("audio");
    expect(request.profile).toMatchObject({
      low: 48,
      high: 72,
      coach: "Sunny",
    });
    await route.fulfill({
      json: {
        exercise: {
          ...design,
          kind: "melody",
          duration: 18,
          base: 60,
          source: "ai",
        },
      },
    });
  });
  await page.goto("/practice");
  const designer = page.getByRole("region", { name: "AI exercise design" });
  await designer
    .getByRole("button", { name: "Design my exercise", exact: true })
    .click();
  await expect(
    designer.getByRole("group", { name: "API key needed" }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await designer
    .getByRole("button", { name: "Continue without AI", exact: true })
    .click();
  await expect(designer.getByRole("status")).toContainText(
    "currently unavailable without an API key",
  );
  await expect(
    page.getByRole("region", { name: "Your practice focus" }),
  ).toContainText("comfortable baseline");
  expect(requests).toBe(0);
  await designer
    .getByRole("button", { name: "Design my exercise", exact: true })
    .click();
  await designer
    .getByRole("button", { name: "Add API key", exact: true })
    .click();
  await designer
    .getByLabel("API key", { exact: true })
    .fill("visitor-design-fixture");
  await designer
    .getByRole("button", { name: "Save AI connection", exact: true })
    .click();
  expect(requests).toBe(0);
  await designer
    .getByRole("button", { name: "Design my exercise", exact: true })
    .click();
  await expect(
    designer.getByRole("heading", { name: design.name, exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/ai-design-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await designer
    .getByRole("button", { name: "Use this exercise", exact: true })
    .click();
  await expect(page).toHaveURL(/\/record\/designed$/);
  await expect(
    page.getByRole("heading", { name: design.name, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: design.name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play reference tones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop reference", exact: true })
    .click();
  await page.getByLabel("Upload an audio file").setInputFiles(targetWav());
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText("100");
  await page.reload();
  await expect(page.locator(".score-circle strong")).toHaveText("100");
});

test("invalid AI targets and provider errors retain useful local practice", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "musecoach-ai-connection",
      JSON.stringify({
        provider: "gemini",
        key: "visitor-fixture",
        model: "",
        remembered: true,
      }),
    ),
  );
  await page.goto("/practice");
  const designer = page.getByRole("region", { name: "AI exercise design" });
  await page.route("**/api/exercise", (route) =>
    route.fulfill({
      json: {
        exercise: {
          ...design,
          targets: design.targets.map((t) => ({ ...t, midi: 100 })),
        },
      },
    }),
  );
  await designer
    .getByRole("button", { name: "Design my exercise", exact: true })
    .click();
  await expect(designer.getByRole("alert")).toContainText(
    "range and timing checks",
  );
  await expect(
    designer.getByRole("button", { name: "Use this exercise", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/exercise");
  await page.route("**/api/exercise", (route) =>
    route.fulfill({ status: 429, json: { error: "Provider quota reached." } }),
  );
  await designer
    .getByRole("button", { name: "Design my exercise", exact: true })
    .click();
  await expect(designer.getByRole("alert")).toContainText(
    "Provider quota reached",
  );
  await expect(
    page.getByRole("region", { name: "Your practice focus" }),
  ).toBeVisible();
});

test("exercise design endpoint requires a visitor key and rejects cross-origin calls", async ({
  request,
}) => {
  const missing = await request.post("/api/exercise", {
    data: { profile: {}, sessions: [] },
  });
  expect(missing.status()).toBe(400);
  expect(missing.headers()["cache-control"]).toBe("no-store");
  const crossOrigin = await request.post("/api/exercise", {
    headers: { origin: "https://untrusted.example" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
});

test("a saved design is checked again after the comfortable range changes", async ({
  page,
}) => {
  await page.addInitScript(
    ({ profile, draft }) => {
      localStorage.setItem("musecoach-profile", JSON.stringify(profile));
      localStorage.setItem(
        "musecoach-designed-exercise",
        JSON.stringify(draft),
      );
    },
    { profile: { ...defaultProfile, low: 48, high: 59 }, draft: design },
  );
  await page.goto("/record/designed");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "range and timing checks",
  );
  await expect(
    page.getByRole("button", { name: "Play reference tones", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Return to Practice", exact: true }),
  ).toBeVisible();
});
