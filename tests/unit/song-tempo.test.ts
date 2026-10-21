import { expect, it, vi } from "vitest";
import { exerciseSpeeds, withTempo } from "../../lib/exercise-tempo";
import {
  exerciseKinds,
  makeExercise,
  midiHz,
  exerciseKey,
} from "../../lib/exercises";
import { defaultProfile, Exercise, PitchFrame, Session } from "../../lib/types";
import { scoreExercise, summarize } from "../../lib/analysis";
import {
  buildSongReference,
  validateSongReference,
} from "../../lib/song-reference";
import { searchSongs } from "../../lib/song-search";
import {
  historyBackupJSON,
  parseHistoryBackup,
} from "../../lib/history-backup";

const song = {
  id: "12345678-1234-1234-1234-123456789abc",
  title: "Fixture song",
  artist: "Fixture artist",
};
function framesFor(e: Exercise, transpose = 0): PitchFrame[] {
  return Array.from({ length: Math.ceil(e.duration / 0.05) }, (_, i) => {
    const time = i * 0.05,
      target = e.targets.find(
        (t) => time >= t.start && time < t.start + t.duration,
      );
    return {
      time,
      hz: target ? midiHz(target.midi + transpose) : null,
      confidence: target ? 0.99 : 0,
      rms: target ? 0.1 : 0,
    };
  });
}
it.each(exerciseSpeeds)(
  "scores all 100 references at %s speed using their actual scaled timing",
  (speed) => {
    for (const kind of exerciseKinds) {
      const original = makeExercise(kind, 55, defaultProfile),
        snapshot = JSON.stringify(original),
        changed = withTempo(original, speed);
      expect(changed.targets[0].start).toBe(
        3 + (original.targets[0].start - 3) / speed,
      );
      expect(changed.duration).toBeGreaterThanOrEqual(15);
      expect(changed.duration).toBeLessThanOrEqual(60);
      expect(
        scoreExercise(framesFor(changed), changed).score,
      ).toBeGreaterThanOrEqual(95);
      expect(
        scoreExercise(framesFor(changed, 6), changed).score,
      ).toBeLessThanOrEqual(20);
      expect(JSON.stringify(original)).toBe(snapshot);
      if (speed !== 1)
        expect(exerciseKey(original)).not.toBe(exerciseKey(changed));
    }
  },
);
it("rejects unsupported speeds and references exceeding duration limits", () => {
  const e = makeExercise("hold", 60, defaultProfile);
  for (const speed of [0, -1, NaN, Infinity, 2])
    expect(() => withTempo(e, speed)).toThrow();
  expect(() => withTempo({ ...e, duration: 60 }, 0.6)).toThrow();
});
it("scores defined song targets across long rests using target coverage", () => {
  const e: Exercise = {
    kind: "melody",
    base: 60,
    source: "song",
    song,
    duration: 60,
    targets: [
      { midi: 60, start: 3, duration: 2.5 },
      { midi: 64, start: 40, duration: 2.5 },
    ],
  };
  const analysis = summarize(framesFor(e), e.duration, 0, e);
  expect(analysis.coverage).toBeLessThan(0.1);
  expect(analysis.score).toBeGreaterThanOrEqual(95);
  expect(analysis.warnings.join(" ")).not.toContain("Much of this take");
});
const guide = () =>
  summarize(
    Array.from({ length: 320 }, (_, i) => ({
      time: i * 0.05,
      hz:
        i % 40 < 32 ? midiHz(55 + [0, 4, 7, 2][Math.floor(i / 40) % 4]) : null,
      confidence: i % 40 < 32 ? 0.99 : 0,
      rms: 0.1,
    })),
    16,
    0,
  );
it("extracts genuine local song targets, adds count-in, scores correct/wrong takes and respects range", () => {
  const e = buildSongReference(song, guide(), defaultProfile);
  expect(e.duration).toBe(19);
  expect(e.targets[0]).toMatchObject({ start: 3, midi: 55 });
  expect(scoreExercise(framesFor(e), e).score).toBeGreaterThanOrEqual(95);
  expect(scoreExercise(framesFor(e, 6), e).score).toBeLessThanOrEqual(20);
  expect(() => validateSongReference(e, { low: 65, high: 72 })).toThrow();
  expect(exerciseKey(e)).not.toBe(
    exerciseKey({
      ...e,
      song: { ...song, id: "aaaaaaaa-1234-1234-1234-123456789abc" },
    }),
  );
});
it("rejects unusable, short, long, overlapping and out-of-range song references", () => {
  const a = guide(),
    e = buildSongReference(song, a, defaultProfile);
  expect(() =>
    buildSongReference(song, { ...a, duration: 60 }, defaultProfile),
  ).toThrow();
  expect(() =>
    buildSongReference(song, { ...a, duration: 14 }, defaultProfile),
  ).toThrow();
  expect(() =>
    buildSongReference(
      song,
      { ...a, frames: a.frames.map((f) => ({ ...f, hz: null })) },
      defaultProfile,
    ),
  ).toThrow();
  expect(() =>
    validateSongReference(
      { ...e, targets: [...e.targets, e.targets[0]] },
      defaultProfile,
    ),
  ).toThrow();
  expect(() =>
    validateSongReference({ ...e, duration: NaN }, defaultProfile),
  ).toThrow();
});
it("round-trips song metadata and tempo in private backups without retaining guide audio", () => {
  const e = withTempo(buildSongReference(song, guide(), defaultProfile), 0.75);
  const s: Session = {
    id: "song-fixture",
    date: "2026-10-21T10:00:00Z",
    title: "Song practice",
    context: "melody",
    audioSaved: false,
    analysis: summarize(framesFor(e), e.duration, 0, e),
  };
  const saved = parseHistoryBackup(historyBackupJSON(defaultProfile, [s]));
  expect(saved.sessions[0].analysis.exercise).toEqual(e);
  expect(saved.audioIncluded).toBe(false);
});
it("searches the fixed catalogue with a descriptive agent and canonical results", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      recordings: [
        {
          id: song.id,
          title: song.title,
          "artist-credit": [{ name: song.artist }],
          secret: "exclude",
        },
        { id: "invalid", title: "No", "artist-credit": [] },
      ],
    }),
  );
  expect(await searchSongs("Fixture", fetcher)).toEqual([song]);
  expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe("musicbrainz.org");
  expect(fetcher.mock.calls[0][1].headers["User-Agent"]).toContain("Musecoach");
  expect(fetcher.mock.calls[0][1].redirect).toBe("error");
});
it("rejects invalid searches and reports unavailable/malformed catalogue responses", async () => {
  const fetcher = vi.fn();
  await expect(searchSongs("x", fetcher)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(new Response("unavailable", { status: 503 }));
  await expect(searchSongs("Fixture", fetcher)).rejects.toThrow(
    "temporarily unavailable",
  );
  fetcher.mockResolvedValue(Response.json({ unexpected: [] }));
  await expect(searchSongs("Fixture", fetcher)).rejects.toThrow(
    "unexpected response",
  );
});
