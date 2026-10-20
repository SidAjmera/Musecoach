import { expect, it } from "vitest";
import {
  historyBackupJSON,
  parseHistoryBackup,
  validateHistoryBackup,
} from "../../lib/history-backup";
import { defaultProfile, Session } from "../../lib/types";
import { analyzeSamples, summarize } from "../../lib/analysis";
import { exerciseKinds, makeExercise, midiHz } from "../../lib/exercises";

const free: Session = {
  id: "free-fixture",
  date: "2026-10-20T10:00:00.000Z",
  title: "A free take",
  context: "free",
  audioSaved: true,
  analysis: analyzeSamples(new Float32Array(12000 * 16), 12000),
};
const backup = () => JSON.parse(historyBackupJSON(defaultProfile, [free]));
it("round-trips supported measurements and profile without claiming to retain audio", () => {
  const restored = parseHistoryBackup(
    historyBackupJSON(defaultProfile, [free]),
  );
  expect(restored.profile).toEqual(defaultProfile);
  expect(restored.sessions[0].analysis).toEqual(free.analysis);
  expect(restored.sessions[0].audioSaved).toBe(false);
  expect(restored.audioIncluded).toBe(false);
  const notes = { ...free, notes: "Keep a gentle entry and leave a gap." };
  expect(
    parseHistoryBackup(historyBackupJSON(defaultProfile, [notes])).sessions[0]
      .notes,
  ).toBe(notes.notes);
});
it("carries favourites while keeping older profile backups compatible", () => {
  const profile = {
    ...defaultProfile,
    favoriteExercises: ["hold", "scale"] as const,
  };
  const restored = parseHistoryBackup(
    historyBackupJSON(
      { ...profile, favoriteExercises: [...profile.favoriteExercises] },
      [free],
    ),
  );
  expect(restored.profile.favoriteExercises).toEqual(["hold", "scale"]);
  const legacy = backup();
  delete legacy.profile.favoriteExercises;
  expect(validateHistoryBackup(legacy).profile.favoriteExercises).toEqual([]);
  const invalid = backup();
  invalid.profile.favoriteExercises = ["unknown-exercise"];
  expect(() => validateHistoryBackup(invalid)).toThrow();
});
it("strips credentials, conversations, blobs and arbitrary storage fields on export and import", () => {
  const profile = {
    ...defaultProfile,
    key: "fixture-private-key",
    storage: { connection: "fixture-key" },
  };
  const session = {
    ...free,
    audio: new Blob(["private-recording-fixture"]),
    ai: { key: "fixture-key" },
  };
  const json = historyBackupJSON(profile, [session]);
  expect(json).not.toMatch(
    /fixture-private-key|fixture-key|private-recording-fixture|connection/,
  );
  const malicious = {
    ...backup(),
    ai: { key: "incoming-fixture-key" },
    profile: { ...defaultProfile, key: "incoming-fixture-key" },
  };
  expect(JSON.stringify(validateHistoryBackup(malicious))).not.toContain(
    "incoming-fixture-key",
  );
});
it("preserves all 100 exercise references and genuine scores", () => {
  const sessions = exerciseKinds.map((kind): Session => {
    const exercise = makeExercise(kind, 60, defaultProfile);
    const frames = Array.from({ length: 360 }, (_, i) => {
      const time = i * 0.05,
        target = exercise.targets.find(
          (t) => time >= t.start && time < t.start + t.duration,
        );
      return {
        time,
        hz: target ? midiHz(target.midi) : null,
        confidence: target ? 1 : 0,
        rms: target ? 0.1 : 0,
      };
    });
    return {
      id: kind,
      date: free.date,
      title: kind,
      context: kind,
      audioSaved: false,
      analysis: summarize(frames, 18, 0, exercise),
    };
  });
  const restored = parseHistoryBackup(
    historyBackupJSON(defaultProfile, sessions),
  );
  expect(restored.sessions).toHaveLength(100);
  expect(restored.sessions.map((s) => s.analysis.exercise)).toEqual(
    sessions.map((s) => s.analysis.exercise),
  );
  expect(restored.sessions.map((s) => s.analysis.score)).toEqual(
    sessions.map((s) => s.analysis.score),
  );
});
it.each([
  (data: ReturnType<typeof backup>) => {
    data.version = 99;
  },
  (data: ReturnType<typeof backup>) => {
    data.sessions.push(data.sessions[0]);
  },
  (data: ReturnType<typeof backup>) => {
    data.sessions[0].id = "../outside";
  },
  (data: ReturnType<typeof backup>) => {
    data.sessions[0].analysis.score = 101;
  },
  (data: ReturnType<typeof backup>) => {
    data.sessions[0].analysis.frames[0].time = -1;
  },
  (data: ReturnType<typeof backup>) => {
    data.sessions[0].date = "not-a-date";
  },
  (data: ReturnType<typeof backup>) => {
    data.profile.low = 90;
    data.profile.high = 40;
  },
  (data: ReturnType<typeof backup>) => {
    data.sessions[0].context = "unknown-exercise";
  },
])("rejects malformed or conflicting records %#", (mutate) => {
  const data = backup();
  mutate(data);
  expect(() => validateHistoryBackup(data)).toThrow(
    "supported Musecoach backup",
  );
});
it("rejects arbitrary JSON, broken files and non-finite measurements", () => {
  for (const raw of ["not-json", "null", "[]", '{"key":"fixture"}'])
    expect(() => parseHistoryBackup(raw)).toThrow();
  const data = backup();
  data.sessions[0].analysis.metrics[0].value = NaN;
  expect(() => validateHistoryBackup(data)).toThrow();
});
