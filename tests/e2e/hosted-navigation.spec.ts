import { test, expect } from "@playwright/test";

test("exercise choice applies immediately while network navigation is delayed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(/\/practice$/);
  let selectionRequested = false;
  await page.route(/\/practice\/match(?:\?|$)/, async (route) => {
    selectionRequested = true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Opening the exercise may cancel this superseded navigation request.
    await route.continue().catch(() => {});
  });
  const match = page.getByRole("button", { name: "Match a note", exact: true });
  await match.click();
  await expect.poll(() => selectionRequested).toBe(true);
  await expect(page).toHaveURL(/\/practice$/);
  await expect(match).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  await page
    .getByRole("button", { name: "Open exercise", exact: true })
    .click();
  await expect(page).toHaveURL(/\/record\/match\/60$/);
  await expect(
    page.getByRole("heading", { name: /Match a note/ }),
  ).toBeVisible();
});
