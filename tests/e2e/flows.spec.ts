import { test, expect, Page } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
const fixtureDir = join(process.cwd(), "test-results", "fixtures");
mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
mkdirSync(fixtureDir, { recursive: true });
function wav(name: string, seconds = 16, kind = "constant") {
  const rate = 16000,
    length = rate * seconds,
    b = Buffer.alloc(44 + length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate,
      active =
        kind === "exercise"
          ? [3, 7, 11, 15].some((s) => t >= s && t < s + 2.5)
          : kind !== "silence";
    const hz = kind === "exercise" ? 261.625565 : 220;
    b.writeInt16LE(
      active ? Math.round(10000 * Math.sin(2 * Math.PI * hz * t)) : 0,
      44 + i * 2,
    );
  }
  const path = join(fixtureDir, name);
  writeFileSync(path, b);
  return path;
}
const singing = wav("singing.wav"),
  exercise = wav("exercise.wav", 18, "exercise"),
  short = wav("short.wav", 4),
  silence = wav("silence.wav", 16, "silence");
async function onboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Edit your profile", exact: true })
    .click();
  await page.getByLabel("What should we call you?").fill("Ari");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /Theo Curious/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "Save my preferences" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Ari." }),
  ).toBeVisible();
}
async function upload(page: Page, path: string) {
  await page.getByLabel("Upload an audio file").setInputFiles(path);
  await expect(
    page.getByRole("heading", { name: "Your take is ready." }),
  ).toBeVisible();
}
test("complete onboarding → upload → review → exercise → history, reload and deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await onboard(page);
  await page.getByRole("link", { name: /Let’s hear you/ }).click();
  await upload(page, singing);
  await page.getByLabel("Save audio in this browser").check();
  await page.getByRole("button", { name: "Review my take" }).click();
  await expect(
    page.getByRole("heading", { name: "Every take tells you something." }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Free-singing practice indicator")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The measurements" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await page
    .getByRole("button", { name: /Play from/ })
    .first()
    .click();
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Match a note", exact: true }).click();
  await page.getByLabel("Base note").selectOption("60");
  await page.getByRole("button", { name: "Open exercise" }).click();
  await expect(
    page.getByRole("button", { name: "Play reference tones" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play reference tones" }).click();
  await page
    .getByRole("button", { name: "Stop reference", exact: true })
    .click();
  await upload(page, exercise);
  await page.getByRole("button", { name: "Review my take" }).click();
  await expect(page.getByText("Guided exercise score")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("Pitch within ±50 cents")).toBeVisible();
  // Repeat the identical reference so progress is based on genuinely comparable attempts.
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Match a note", exact: true }).click();
  await page.getByLabel("Base note").selectOption("60");
  await page.getByRole("button", { name: "Open exercise" }).click();
  await upload(page, exercise);
  await page.getByRole("button", { name: "Review my take" }).click();
  await expect(
    page.getByText("0 points from your previous comparable attempt."),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: /Exercise score, out of 100, oldest to newest:/,
    }),
  ).toBeVisible();
  await page.getByLabel("Measured trend").selectOption("accuracy");
  await expect(
    page.getByRole("img", { name: /Pitch within ±50 cents,/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pitch stability goal complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Pitch stability goal complete",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saved takes", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Free singing/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Match a note/ })).toHaveCount(2);
  const csvDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download progress CSV", exact: true })
    .click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/^musecoach-progress-.*\.csv$/);
  const exported = readFileSync((await csv.path())!, "utf8");
  expect(exported).toContain('"practice_score_out_of_100"');
  expect(exported).toContain('"Free singing"');
  expect(exported).toContain('"Guided exercise"');
  expect(exported.trim().split("\r\n")).toHaveLength(4);
  await page.reload();
  await expect(page.getByRole("link", { name: /Match a note/ })).toHaveCount(2);
  await expect(
    page.getByRole("button", {
      name: "Pitch stability goal complete",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /Free singing/ }).click();
  await page
    .getByRole("button", { name: "Delete saved audio, keep measurements" })
    .click();
  await page.getByRole("button", { name: "Delete audio", exact: true }).click();
  await expect(
    page.getByText("Audio wasn’t saved with this session."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete this session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete session", exact: true })
    .click();
  await expect(page).toHaveURL(/progress/);
  await expect(page.getByRole("link", { name: /Free singing/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Delete all local data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete all local data", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByText("No sessions here yet.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("invalid duration, silence, missing AI, coach switching, keyboard and layout", async ({
  page,
}) => {
  await onboard(page);
  await page
    .getByRole("link", { name: "Record & Review", exact: true })
    .click();
  await page.getByLabel("Upload an audio file").setInputFiles(short);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "at least 15 seconds",
  );
  await page.getByLabel("Upload an audio file").setInputFiles({
    name: "broken.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("not audio"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "couldn’t decode",
  );
  await upload(page, silence);
  await page.getByRole("button", { name: "Review my take" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Let’s look at your recording.",
    }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Too little usable pitched audio")).toBeVisible();
  await page.getByRole("link", { name: "My Coach", exact: true }).click();
  await expect(
    page.getByText("AI coach unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Customise coach" }).click();
  await page.getByRole("button", { name: "Go to step 2" }).click();
  await page.getByRole("button", { name: /Sage Calm/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("androgynous");
  await page.getByLabel("Pronouns", { exact: true }).fill("they/them");
  await page.getByRole("button", { name: "Save my preferences" }).click();
  await expect(page.getByRole("heading", { name: "Meet Sage." })).toBeVisible();
  await page.reload();
  await expect(page.getByText("custom version · they/them")).toBeVisible();
  await page.getByRole("button", { name: /Switch to dark mode/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page.getByRole("link", { name: /Free singing/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Let’s look at your recording.",
    }),
  ).toBeVisible();
});
test("permission denial is recoverable without using a real microphone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Denied fixture", "NotAllowedError")),
    });
  });
  await onboard(page);
  await page
    .getByRole("link", { name: "Record & Review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Microphone access was denied",
  );
  await expect(page.getByLabel("Upload an audio file")).toBeEnabled();
});
test("fake microphone capture, stop, and navigation release tracks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as unknown as { fixtureStreams: MediaStream[] }).fixtureStreams =
      [];
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      (
        window as unknown as { fixtureStreams: MediaStream[] }
      ).fixtureStreams.push(stream);
      return stream;
    };
  });
  await onboard(page);
  await page
    .getByRole("link", { name: "Record & Review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { fixtureStreams: MediaStream[] }
          ).fixtureStreams[0]?.getTracks()[0]?.readyState,
      ),
    )
    .toBe("live");
  await page.getByRole("link", { name: "My Coach", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { fixtureStreams: MediaStream[] }
        ).fixtureStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("link", { name: "Record & Review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await expect(page.getByText("00:15", { exact: false })).toBeVisible({
    timeout: 18000,
  });
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("heading", { name: "Your take is ready." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { fixtureStreams: MediaStream[] }
        ).fixtureStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Discard take" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("main screens have accessible layouts, keyboard focus, and visual snapshots", async ({
  page,
}, testInfo) => {
  // This case visits and scans all main screens in both themes and saves
  // full-page images. Allow time for those checks on slower Windows machines.
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const [path, name] of [
    ["/", "home"],
    ["/record", "record"],
    ["/coach", "coach"],
    ["/practice", "practice"],
    ["/progress", "progress"],
  ]) {
    if (name !== "home")
      await page
        .getByRole("link", {
          name:
            name === "record"
              ? "Record & Review"
              : name === "coach"
                ? "My Coach"
                : name === "practice"
                  ? "Practice"
                  : "Progress",
          exact: true,
        })
        .click();
    await expect(page).toHaveURL(new URL(path, page.url()).href);
    await expect(page).toHaveTitle(/Musecoach/);
    await expect(page.locator("#page-title")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "artifacts/" + name + "-" + testInfo.project.name + ".png",
      fullPage: true,
    });
    if (name === "practice") {
      await page.getByLabel("Base note").selectOption("72");
      await page
        .getByRole("button", { name: "Follow a short melody", exact: true })
        .click();
      await expect(page).toHaveURL(/practice\/melody$/);
      await expect(
        page.getByRole("heading", { name: "A little melodic adventure" }),
      ).toBeVisible();
      await expect
        .poll(async () =>
          Number(await page.getByLabel("Base note").inputValue()),
        )
        .toBeLessThanOrEqual(68);
      expect(
        Number(await page.getByLabel("Base note").inputValue()),
      ).toBeGreaterThanOrEqual(48);
      await expect(page).toHaveTitle(/Musecoach/);
    }
    if (name === "progress")
      await expect(
        page.getByRole("button", {
          name: "Download progress CSV",
          exact: true,
        }),
      ).toBeDisabled();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  for (const [label, name] of [
    ["Progress", "progress"],
    ["Home", "home"],
    ["Record & Review", "record"],
    ["My Coach", "coach"],
    ["Practice", "practice"],
  ]) {
    if (name !== "progress")
      await page.getByRole("link", { name: label, exact: true }).click();
    const darkPath = name === "home" ? "/" : "/" + name;
    await expect(page).toHaveURL(new URL(darkPath, page.url()).href);
    await expect(page).toHaveTitle(/Musecoach/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      dark.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: "artifacts/" + name + "-dark-" + testInfo.project.name + ".png",
      fullPage: true,
    });
  }
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 850, height: 1000 });
    await page.getByRole("link", { name: "Home", exact: true }).click();
    const tablet = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      tablet.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "artifacts/home-tablet.png",
      fullPage: true,
    });
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("provider-independent coach UI sends only after submission and preserves recoverable errors", async ({
  page,
}) => {
  await onboard(page);
  for (const provider of ["Gemini", "OpenAI", "Anthropic", "Grok (xAI)"]) {
    const submitted: unknown[] = [];
    await page.route("**/api/coach", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { available: true, provider } });
      submitted.push(route.request().postDataJSON());
      return route.fulfill({
        json: { reply: provider + " fixture: try a comfortable held note." },
      });
    });
    await page.goto("/coach");
    await page
      .getByRole("combobox", { name: "AI provider", exact: true })
      .selectOption({ label: provider });
    await page
      .getByLabel("API key", { exact: true })
      .fill("visitor-fixture-key");
    await page
      .getByRole("button", { name: "Save AI connection", exact: true })
      .click();
    await expect(
      page.getByText("AI coach configured", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("with " + provider + ". Audio is never sent.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(submitted).toHaveLength(0);
    await page
      .getByLabel("Ask about your results or practice")
      .fill("What should I try next?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText(provider + " fixture: try a comfortable held note.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      ai: { key: "visitor-fixture-key" },
      message: "What should I try next?",
      profile: { coach: "Theo" },
    });
    expect(submitted[0]).not.toHaveProperty("audio");
    await page.unroute("**/api/coach");
  }
  await page.route("**/api/coach", async (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { available: true, provider: "Gemini" } })
      : route.fulfill({
          status: 429,
          json: {
            error:
              "Gemini has reached a rate limit or billing quota. Wait and retry.",
          },
        }),
  );
  await page.goto("/coach");
  await page.getByLabel("API key", { exact: true }).fill("visitor-fixture-key");
  await page
    .getByRole("button", { name: "Save AI connection", exact: true })
    .click();
  await expect(
    page.getByText("AI coach configured", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Ask about your results or practice")
    .fill("Explain my latest take.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "rate limit or billing quota",
  );
  await expect(
    page.getByLabel("Ask about your results or practice"),
  ).toHaveValue("Explain my latest take.");
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeEnabled();
});
