import { test, expect } from "@playwright/test";

test("coach gallery defaults, customization and saved appearance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Edit your profile", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByText(/Every coach can be customized/)).toBeVisible();
  for (const coach of ["Jules", "Rex", "Theo", "Ash", "Kai"]) {
    await expect(
      dialog.getByRole("img", {
        name: `${coach}, original masculine coach illustration`,
        exact: true,
      }),
    ).toBeVisible();
  }
  for (const coach of ["Sunny", "Nova", "Sage", "Cleo", "Lola"]) {
    await expect(
      dialog.getByRole("img", {
        name: `${coach}, original feminine coach illustration`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await dialog.getByRole("button", { name: /Theo Curious/ }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Male", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Female", exact: true }).click();
  await dialog.getByRole("button", { name: /Back/ }).click();
  await expect(
    dialog.getByRole("img", {
      name: "Theo, original feminine coach illustration",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("img", {
      name: "Rex, original masculine coach illustration",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Custom", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("androgynous");
  await dialog.getByLabel("Pronouns", { exact: true }).fill("they/them");
  await dialog.getByRole("button", { name: /Back/ }).click();
  await dialog.getByRole("button", { name: /Rex Direct/ }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog.getByRole("combobox", { name: "Appearance", exact: true }),
  ).toHaveValue("androgynous");
  await expect(dialog.getByLabel("Pronouns", { exact: true })).toHaveValue(
    "they/them",
  );
  await dialog.getByRole("button", { name: "Save my preferences" }).click();
  await page.reload();
  await page.getByRole("link", { name: "My Coach", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Rex, original androgynous coach illustration",
      exact: true,
    }),
  ).toBeVisible();
});
