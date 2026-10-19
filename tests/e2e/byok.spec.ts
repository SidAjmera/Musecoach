import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

async function openCoach(page: Page) {
  await page.goto("/coach");
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
}
async function saveConnection(page: Page, remember = false) {
  await page.getByLabel("API key", { exact: true }).fill("private-fixture-key");
  if (remember)
    await page
      .getByLabel("Remember my key on this device", { exact: true })
      .check();
  await page
    .getByRole("button", { name: "Save AI connection", exact: true })
    .click();
  await expect(
    page.getByText("AI coach configured", { exact: true }),
  ).toBeVisible();
}

test("BYOK saves only by opt-in, survives navigation and forgets keys", async ({
  page,
}, testInfo) => {
  const posts: unknown[] = [];
  await page.route("**/api/coach", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { mode: "byok", available: false } });
    posts.push(route.request().postDataJSON());
    return route.fulfill({ json: { reply: "Try a comfortable held note." } });
  });
  await openCoach(page);
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: `artifacts/byok-settings-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await saveConnection(page);
  expect(posts).toHaveLength(0);
  expect(
    await page.evaluate(() => localStorage.getItem("musecoach-ai-connection")),
  ).toBeNull();
  await expect(page.getByRole("main")).not.toContainText("private-fixture-key");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "My Coach", exact: true }).click();
  await expect(
    page.getByText("AI coach configured", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Ask about your results or practice")
    .fill("What next?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Try a comfortable held note.", { exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    ai: { provider: "gemini", key: "private-fixture-key", model: "" },
  });
  expect(posts[0]).not.toHaveProperty("audio");
  expect(
    await page.evaluate(() => localStorage.getItem("musecoach-chat")),
  ).not.toContain("private-fixture-key");
  await page.reload();
  await expect(
    page.getByText("AI coach unavailable", { exact: true }),
  ).toBeVisible();
  await saveConnection(page, true);
  await page.reload();
  await expect(
    page.getByText("AI coach configured", { exact: true }),
  ).toBeVisible();
  await page.getByText("Manage your AI connection", { exact: true }).click();
  await expect(page.getByLabel("API key", { exact: true })).toHaveValue("");
  // Another browser profile cannot use this visitor's connection.
  const otherContext = await page.context().browser()!.newContext();
  try {
    const other = await otherContext.newPage();
    await other.goto("http://127.0.0.1:3000/coach");
    await other
      .getByRole("button", { name: "Explore first", exact: true })
      .click();
    await expect(
      other.getByRole("button", { name: "Send message", exact: true }),
    ).toBeDisabled();
    expect(
      await other.evaluate(() =>
        localStorage.getItem("musecoach-ai-connection"),
      ),
    ).toBeNull();
  } finally {
    await otherContext.close();
  }
  await page
    .getByRole("button", { name: "Forget API key", exact: true })
    .click();
  await expect(
    page.getByText("AI coach unavailable", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("musecoach-ai-connection")),
  ).toBeNull();
  await saveConnection(page, true);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete all local data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete all local data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meet your voice.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("musecoach-ai-connection")),
  ).toBeNull();
  expect(posts).toHaveLength(1);
});

test("public chat route requires visitor credentials and rejects custom URLs", async ({
  request,
}) => {
  const status = await request.get("/api/coach");
  expect(status.headers()["cache-control"]).toBe("no-store");
  expect(await status.json()).toMatchObject({ mode: "byok", available: false });
  for (const body of [
    { message: "hello" },
    { ai: { provider: "gemini", key: "fixture", baseURL: "http://127.0.0.1" } },
  ]) {
    const result = await request.post("/api/coach", { data: body });
    expect(result.status()).toBe(400);
    expect(JSON.stringify(await result.json())).not.toContain("fixture");
  }
  const crossOrigin = await request.post("/api/coach", {
    headers: { origin: "https://other.example" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
});
