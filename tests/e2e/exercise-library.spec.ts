import { expect, test } from "@playwright/test";
import { defaultProfile } from "../../lib/types";

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
  await expect(library.getByRole("status")).toHaveText("30 of 30 exercises");
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
  await expect(library.getByRole("status")).toHaveText("4 of 30 exercises");
  await page.getByLabel("Exercise focus").selectOption("all");
  await expect(
    library.getByRole("button", { name: "Octave echoes", exact: true }),
  ).toBeDisabled();
  await expect(
    library.getByRole("button", { name: "Match a note", exact: true }),
  ).toBeEnabled();
});
