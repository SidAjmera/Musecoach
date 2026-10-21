import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeExercise, midiHz } from "../../lib/exercises";
import { withTempo } from "../../lib/exercise-tempo";
import { defaultProfile, Exercise } from "../../lib/types";

function wav(exercise?: Exercise) {
  const rate = 12000,
    seconds = exercise?.duration || 16;
  const samples = Math.ceil(rate * seconds),
    data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  let phase = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / rate,
      target = exercise?.targets.find(
        (n) => t >= n.start && t < n.start + n.duration,
      );
    const midi = exercise
      ? target?.midi
      : t % 2 < 1.6
        ? 55 + [0, 4, 7, 2][Math.floor(t / 2) % 4]
        : undefined;
    phase += (2 * Math.PI * midiHz(midi || 55)) / rate;
    data.writeInt16LE(
      midi === undefined ? 0 : Math.round(5000 * Math.sin(phase)),
      44 + i * 2,
    );
  }
  return { name: "solo-guide.wav", mimeType: "audio/wav", buffer: data };
}
test("exercise tempo changes playback targets, capture duration and genuine scoring", async ({
  page,
}) => {
  await page.goto("/record/melody/60");
  await page.getByLabel("Exercise speed", { exact: true }).selectOption("1.2");
  await expect(
    page.getByText("15.5s with count-in", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Exercise speed", { exact: true }).selectOption("0.75");
  await expect(
    page.getByText("23.0s with count-in", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Play reference tones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop reference", exact: true })
    .click();
  const reference = withTempo(makeExercise("melody", 60, defaultProfile), 0.75);
  await page.getByLabel("Upload an audio file").setInputFiles(wav(reference));
  await expect(
    page.getByLabel("Exercise speed", { exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  expect(
    Number(await page.locator(".score-circle strong").textContent()),
  ).toBeGreaterThanOrEqual(95);
  await expect(page.getByText(/75% reference speed/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/75% reference speed/)).toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByLabel("Exercise reference").locator("option"),
  ).toContainText("75% speed");
});
test("song search builds a local guide reference and scores a real comparison without an AI key", async ({
  page,
}, testInfo) => {
  const song = {
    id: "12345678-1234-1234-1234-123456789abc",
    title: "Fixture song",
    artist: "Fixture artist",
  };
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.route("**/api/songs?*", (route) =>
    route.fulfill({ json: { songs: [song] } }),
  );
  await page.goto("/practice");
  await page.getByText("Practise a real song", { exact: true }).click();
  await page
    .getByLabel("Song title or artist", { exact: true })
    .fill("Fixture");
  await page.getByRole("button", { name: "Search songs", exact: true }).click();
  await page
    .getByRole("button", { name: "Fixture song · Fixture artist", exact: true })
    .click();
  await page
    .getByLabel("Load solo-vocal song guide", { exact: true })
    .setInputFiles({
      name: "broken.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("invalid"),
    });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "decode",
  );
  await page
    .getByLabel("Load solo-vocal song guide", { exact: true })
    .setInputFiles(wav());
  await expect(
    page.getByRole("button", {
      name: "Practise this song phrase",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Your local song guide", { exact: true }),
  ).toHaveAttribute("src", /^blob:/);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .locator("section")
    .filter({ has: page.getByText("Practise a real song", { exact: true }) })
    .screenshot({ path: `artifacts/song-guide-${testInfo.project.name}.png` });
  await page
    .getByRole("button", { name: "Practise this song phrase", exact: true })
    .click();
  await expect(page).toHaveURL(/\/record\/song$/);
  const reference = (await page.evaluate(() =>
    JSON.parse(localStorage.getItem("musecoach-song-reference")!),
  )) as Exercise;
  await page.getByLabel("Upload an audio file").setInputFiles(wav(reference));
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  expect(
    Number(await page.locator(".score-circle strong").textContent()),
  ).toBeGreaterThanOrEqual(95);
  await expect(
    page.getByText(/Song practice · compared with estimated notes/),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  expect(posts).toEqual([]);
  await page.evaluate(() =>
    localStorage.removeItem("musecoach-song-reference"),
  );
  await page.goto("/record/song");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "load a clear solo-vocal guide",
  );
});
test("song search handles unavailable catalogues and rejects invalid requests", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/songs?q=x")).status()).toBe(400);
  expect(
    (
      await request.get("/api/songs?q=hello", {
        headers: { Origin: "https://unrelated.example" },
      })
    ).status(),
  ).toBe(403);
  await page.route("**/api/songs?*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "Song search is temporarily unavailable. Please try again.",
      },
    }),
  );
  await page.goto("/practice");
  await page.getByText("Practise a real song", { exact: true }).click();
  await page
    .getByLabel("Song title or artist", { exact: true })
    .fill("Fixture");
  await page.getByRole("button", { name: "Search songs", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Search songs", exact: true }),
  ).toBeEnabled();
});

test("song scoring measures target coverage across long intentional rests", async ({
  page,
}) => {
  const reference: Exercise = {
    kind: "melody",
    base: 60,
    source: "song",
    song: {
      id: "12345678-1234-1234-1234-123456789abc",
      title: "Long rests",
      artist: "Fixture",
    },
    duration: 60,
    targets: [
      { midi: 60, start: 3, duration: 2.5 },
      { midi: 64, start: 40, duration: 2.5 },
    ],
  };
  await page.addInitScript(
    (e) => localStorage.setItem("musecoach-song-reference", JSON.stringify(e)),
    reference,
  );
  await page.goto("/record/song");
  await page.getByLabel("Upload an audio file").setInputFiles(wav(reference));
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  expect(
    Number(await page.locator(".score-circle strong").textContent()),
  ).toBeGreaterThanOrEqual(95);
});
