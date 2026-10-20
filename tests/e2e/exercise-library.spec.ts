import { expect, test } from "@playwright/test";
import { defaultProfile } from "../../lib/types";
import { ANALYSIS_VERSION } from "../../lib/analysis";

test("exercise search, categories and comfortable-range restrictions work", async ({
  page,
}) => {
  await page.addInitScript(
    (profile) => {
      localStorage.setItem("musecoach-profile", JSON.stringify(profile));
    },
    { ...defaultProfile, low: 60, high: 64, rangeSet: true },
  );
  await page.goto("/practice");
  const library = page.getByRole("region", { name: "Exercise library" });
  await expect(library.getByRole("status")).toHaveText("100 of 100 exercises");
  await page.getByLabel("Search exercises").fill("third");
  await expect(
    library.getByRole("button", { name: "Minor-third echoes", exact: true }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", { name: "Octave echoes", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search exercises").fill("no-such-exercise");
  await expect(library.getByText(/No exercises match/)).toBeVisible();
  await page.getByLabel("Search exercises").fill("");
  await page.getByLabel("Exercise focus").selectOption("Timing");
  await expect(library.getByRole("status")).toHaveText("16 of 100 exercises");
  await page.getByLabel("Exercise focus").selectOption("all");
  await expect(
    library.getByRole("button", { name: "Octave echoes", exact: true }),
  ).toBeDisabled();
  await expect(
    library.getByRole("button", { name: "Match a note", exact: true }),
  ).toBeEnabled();
});

test("practice focus uses measured timing and opens its evidence", async ({
  page,
}) => {
  await page.goto("/practice");
  const focus = page.getByRole("region", { name: "Your practice focus" });
  await expect(
    focus.getByText("Start with a comfortable baseline", { exact: true }),
  ).toBeVisible();
  // A controlled result fixture isolates recommendation UI from the audio pipeline,
  // which is exercised with real decoded audio in analysis-recovery.spec.ts.
  await page.evaluate(async (version) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("musecoach-v1", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("sessions", "readwrite");
        tx.objectStore("sessions").put({
          id: "focus-fixture",
          date: new Date().toISOString(),
          title: "Timing fixture",
          context: "free",
          audioSaved: false,
          analysis: {
            version,
            duration: 16,
            frames: [],
            voicedSeconds: 10,
            coverage: 0.6,
            range: [55, 62],
            score: 90,
            warnings: [],
            strengths: [],
            improvements: ["Leave clear gaps between notes."],
            observations: [],
            recommendation: "hold",
            formula: "Test fixture",
            metrics: [
              {
                key: "accuracy",
                label: "Pitch accuracy",
                score: 95,
                value: 95,
                unit: "%",
              },
              {
                key: "timing",
                label: "Onset timing",
                score: 30,
                value: 350,
                unit: "ms",
              },
            ],
          },
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, ANALYSIS_VERSION);
  await page.reload();
  await expect(
    focus.getByText("Focus on separated-note timing", { exact: true }),
  ).toBeVisible();
  await focus
    .getByRole("button", { name: "Try short note pulses", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Short note pulses", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/practice\/short-pulses$/);
  await expect(page.locator(".exercise-main h2")).toBeFocused();
  await focus
    .getByText("Keep your latest pointers in mind", { exact: true })
    .click();
  await expect(
    focus.getByText("Leave clear gaps between notes.", { exact: true }),
  ).toBeVisible();
  await focus.getByText("Why this focus?", { exact: true }).click();
  await focus
    .getByRole("link", { name: /Separated-note timing: 30\/100/ })
    .click();
  await expect(page).toHaveURL(/\/session\/focus-fixture$/);
});
