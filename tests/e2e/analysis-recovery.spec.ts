import { test, expect, type Page } from "@playwright/test";
import {
  makeExercise,
  midiHz,
  exerciseKinds,
  exerciseInfo,
} from "../../lib/exercises";
import { defaultProfile, type Exercise } from "../../lib/types";

function voiceWav(stereo = false, exercise?: Exercise, melody = false) {
  const rate = 16000,
    seconds = exercise ? 18 : melody ? 19 : 16,
    channels = stereo ? 2 : 1;
  const data = Buffer.alloc(44 + rate * seconds * channels * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(channels, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * channels * 2, 28);
  data.writeUInt16LE(channels * 2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(data.length - 44, 40);
  let phase = 0,
    seed = 73;
  for (let i = 0; i < rate * seconds; i++) {
    const time = i / rate,
      target = exercise?.targets.find(
        (t) => time >= t.start && time < t.start + t.duration,
      );
    const hz = target
      ? midiHz(target.midi)
      : melody
        ? midiHz(55 + [0, 4, 7, 2, 5][Math.floor(time / 0.3) % 5])
        : 196 * 2 ** ((25 * Math.sin(2 * Math.PI * 5 * time)) / 1200);
    phase += (2 * Math.PI * hz) / rate;
    seed = (1664525 * seed + 1013904223) >>> 0;
    const active = exercise
      ? !!target
      : melody
        ? time % 0.3 < 0.25
        : time % 2.2 < 1.8;
    const sample = active
      ? Math.round(
          32767 *
            (0.0025 *
              (Math.sin(phase) +
                0.5 * Math.sin(2 * phase) +
                0.25 * Math.sin(3 * phase)) +
              0.0002 * (seed / 2 ** 32 - 0.5)),
        )
      : 0;
    data.writeInt16LE(sample, 44 + i * channels * 2);
    if (stereo) data.writeInt16LE(-sample, 46 + i * channels * 2);
  }
  return { name: "quiet-voice.wav", mimeType: "audio/wav", buffer: data };
}

test("19-second short-note singing receives a local score without an API key", async ({
  page,
}) => {
  const aiRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/(coach|exercise)/.test(request.url()) &&
      request.method() === "POST"
    )
      aiRequests.push(request.url());
  });
  await page.goto("/record");
  await review(page, voiceWav(false, undefined, true), true);
  await expect(
    page.getByText("Short-note steadiness", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  await page.getByText("How the score is calculated", { exact: true }).click();
  await expect(page.getByText(/Short-note steadiness =/)).toBeVisible();
  await page.reload();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  expect(aiRequests).toEqual([]);
});
async function review(
  page: Page,
  fixture: ReturnType<typeof voiceWav>,
  save = false,
) {
  await page.getByLabel("Upload an audio file").setInputFiles(fixture);
  await expect(
    page.getByRole("heading", { name: "Your take is ready." }),
  ).toBeVisible();
  if (save) await page.getByLabel("Save audio in this browser").check();
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/, {
    timeout: 30000,
  });
  await expect(
    page.getByRole("img", { name: /^Pitch timeline over/ }),
  ).toBeVisible();
  expect(await page.locator(".pitch-chart svg path").getAttribute("d")).toMatch(
    /L/,
  );
}

test("quiet solo voice and opposite-phase stereo produce scores and a populated graph", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (const stereo of [false, true]) {
    await page
      .getByRole("link", { name: "Record & Review", exact: true })
      .click();
    await review(page, voiceWav(stereo));
    await expect(
      page.getByText(/quiet, but usable pitch was detected/),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  }
});

test("saved failed takes can be reanalysed, looped and downloaded without losing audio", async ({
  page,
}) => {
  await page.goto("/record");
  await review(page, voiceWav(), true);
  const id = page.url().split("/").pop()!;
  await page.evaluate(async (id) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("musecoach-v1", 1);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction("sessions", "readwrite"),
          store = tx.objectStore("sessions"),
          record = store.get(id);
        record.onsuccess = () => {
          const value = record.result;
          value.analysis = {
            ...value.analysis,
            version: "yin-1.0",
            frames: [],
            score: null,
            range: null,
          };
          store.put(value);
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, id);
  await page.reload();
  await expect(page.locator(".score-circle strong")).toHaveText("—");
  await expect(
    page.getByText("No usable pitch detected in this take."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reanalyse saved audio", exact: true })
    .click();
  await expect(
    page.getByText(/Updated this take with the latest detector/),
  ).toBeVisible();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/);
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await page.getByLabel("Phrase start (seconds)").fill("1");
  await page.getByLabel("Phrase end (seconds)").fill("2");
  await page.getByLabel("Loop selected phrase", { exact: true }).check();
  await page
    .getByRole("button", { name: "Play selected phrase", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0.9);
  await page.waitForTimeout(1800);
  expect(
    await page
      .locator("audio")
      .evaluate((audio: HTMLAudioElement) => audio.currentTime),
  ).toBeLessThan(2.2);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download audio", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.wav$/);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("link", { name: /Free singing/ })).toHaveCount(1);
});

test("all 100 exercises have playable references and genuinely scored targets", async ({
  page,
}) => {
  test.setTimeout(600000);
  await page.goto("/practice");
  for (const kind of exerciseKinds) {
    const label = exerciseInfo[kind].label;
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Base note").selectOption("60");
    await page
      .getByRole("button", { name: "Open exercise", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/record/${kind}/60$`));
    await page
      .getByRole("button", { name: "Play reference tones", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Stop reference", exact: true })
      .click();
    await review(page, voiceWav(false, makeExercise(kind, 60, defaultProfile)));
    expect(
      Number(await page.locator(".score-circle strong").textContent()),
    ).toBeGreaterThanOrEqual(95);
    await page.getByRole("link", { name: "Practice", exact: true }).click();
  }
});

test("quiet microphone capture is scored through MediaRecorder and tuner releases its input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    Object.assign(window, { syntheticStreams: streams });
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      await ctx.resume();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        destination = ctx.createMediaStreamDestination();
      osc.frequency.value = 220;
      gain.gain.value = 0.003;
      osc.connect(gain);
      gain.connect(destination);
      osc.start();
      streams.push(destination.stream);
      destination.stream.getTracks().forEach((track) => {
        const stop = track.stop.bind(track);
        track.stop = () => {
          stop();
          osc.stop();
          void ctx.close();
        };
      });
      return destination.stream;
    };
  });
  await page.goto("/record");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { syntheticStreams: MediaStream[] })
          .syntheticStreams.length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Start microphone check", exact: true })
    .click();
  await expect(page.locator(".tuner-reading strong")).toHaveText("A3");
  await page
    .getByRole("button", { name: "Stop microphone check", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { syntheticStreams: MediaStream[] }
      ).syntheticStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByText("00:15", { exact: false })).toBeVisible({
    timeout: 19000,
  });
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your take is ready." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review my take", exact: true })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText(/^\d+$/, {
    timeout: 30000,
  });
  await expect(
    page.getByRole("img", { name: /^Pitch timeline over/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { syntheticStreams: MediaStream[] }
      ).syntheticStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  ).toBe(true);
});

test("quiet MP4/AAC recording decodes and scores when the browser supports it", async ({
  page,
}) => {
  await page.goto("/record");
  const supported = await page.evaluate(() =>
    MediaRecorder.isTypeSupported("audio/mp4"),
  );
  test.skip(!supported, "This browser does not record MP4/AAC.");
  const bytes = await page.evaluate(async () => {
    const context = new AudioContext();
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    oscillator.frequency.value = 220;
    gain.gain.value = 0.003;
    oscillator.connect(gain);
    gain.connect(destination);
    const recorder = new MediaRecorder(destination.stream, {
      mimeType: "audio/mp4",
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    oscillator.start();
    recorder.start(250);
    await new Promise((resolve) => setTimeout(resolve, 16000));
    recorder.stop();
    await stopped;
    oscillator.stop();
    destination.stream.getTracks().forEach((track) => track.stop());
    await context.close();
    return Array.from(
      new Uint8Array(
        await new Blob(chunks, { type: "audio/mp4" }).arrayBuffer(),
      ),
    );
  });
  await review(page, {
    name: "quiet-aac.m4a",
    mimeType: "audio/mp4",
    buffer: Buffer.from(bytes),
  });
});
