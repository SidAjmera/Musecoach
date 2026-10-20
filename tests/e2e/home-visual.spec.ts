import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("home waveform, coach messages and motion controls", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const visual = page.locator(".voice-visual");
  await expect(
    visual.getByText("Your coach, for you.", { exact: true }),
  ).toBeVisible();
  await expect(
    visual.getByText(
      "That tiny win? We’re celebrating it. Let’s try one happy little note!",
    ),
  ).toBeVisible();
  await expect(
    page.locator(".hero").getByRole("img", { name: /coach illustration/ }),
  ).toHaveCount(0);
  const hero = await page.locator(".hero").boundingBox();
  const panel = await visual.boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(hero!.x);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(hero!.x + hero!.width);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(hero!.y + hero!.height);
  await expect(
    page.getByRole("button", { name: "Pause waveform animation" }),
  ).toBeHidden();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: `artifacts/home-waveform-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Pause waveform animation" }).click();
  await expect(
    page.getByRole("button", { name: "Play waveform animation" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".voice-wave-bar")
      .first()
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("paused");
  await page.getByRole("button", { name: "Play waveform animation" }).click();
  expect(
    await page
      .locator(".voice-wave-bar")
      .first()
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("running");
});
