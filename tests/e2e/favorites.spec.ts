import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { defaultProfile } from "../../lib/types";

test("exercise favourites persist, filter, open from Home and travel with backups", async ({
  page,
}) => {
  await page.goto("/practice");
  const library = page.getByRole("region", { name: "Exercise library" });
  const filter = library.getByRole("checkbox", {
    name: /^Show favourites only/,
  });
  await filter.check();
  await expect(library.getByText(/No favourites yet/)).toBeVisible();
  await filter.uncheck();
  await library
    .getByRole("button", {
      name: "Add Match a note to favourites",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    library.getByRole("button", {
      name: "Remove Match a note from favourites",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await library
    .getByRole("button", { name: "Add Hold a note to favourites", exact: true })
    .click();
  await filter.check();
  await expect(library.getByRole("status")).toHaveText("2 of 100 exercises");
  await library
    .getByRole("button", {
      name: "Remove Hold a note from favourites",
      exact: true,
    })
    .click();
  await expect(filter).toBeFocused();
  await expect(library.getByRole("status")).toHaveText("1 of 100 exercises");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.reload();
  await expect(
    library.getByRole("button", {
      name: "Remove Match a note from favourites",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  const home = page.getByRole("region", { name: "Favourite exercises" });
  await expect(home).toBeVisible();
  await home
    .getByRole("button", { name: "Open favourite: Match a note", exact: true })
    .click();
  await expect(page).toHaveURL(/\/practice\/match$/);
  await expect(
    page.getByRole("button", { name: "Match a note", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  const backup = page.getByRole("region", {
    name: "Back up or restore history",
  });
  await backup.getByText("Back up or restore history", { exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await backup
    .getByRole("button", { name: "Download history backup", exact: true })
    .click();
  const downloaded = await downloadEvent;
  const data = JSON.parse(readFileSync((await downloaded.path())!, "utf8"));
  expect(data.profile.favoriteExercises).toEqual(["match"]);
  await page
    .getByRole("button", { name: "Delete all local data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete all local data", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Favourite exercises" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(filter).toHaveAccessibleName("Show favourites only (0)");
});

test("favourites do not bypass the current comfortable range", async ({
  page,
}) => {
  await page.addInitScript(
    (profile) =>
      localStorage.setItem("musecoach-profile", JSON.stringify(profile)),
    { ...defaultProfile, low: 60, high: 62, favoriteExercises: ["octaves"] },
  );
  await page.goto("/practice");
  const library = page.getByRole("region", { name: "Exercise library" });
  await library
    .getByRole("checkbox", { name: /^Show favourites only/ })
    .check();
  await expect(
    library.getByRole("button", { name: "Octave echoes", exact: true }),
  ).toBeDisabled();
  await expect(
    library.getByRole("button", {
      name: "Remove Octave echoes from favourites",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Open favourite: Octave echoes",
      exact: true,
    }),
  ).toBeDisabled();
});
