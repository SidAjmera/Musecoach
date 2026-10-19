import { describe, it, expect } from "vitest";
import {
  analyzeSamples,
  detectPitch,
  scoreExercise,
  summarize,
} from "../../lib/analysis";
import { defaultProfile, PitchFrame } from "../../lib/types";
import { coaches, measuredIntro } from "../../lib/coaches";
import { makeExercise, midiHz } from "../../lib/exercises";
const RATE = 12000;
function sine(hz: number, length = 1024, amp = 0.3) {
  return Float32Array.from(
    { length },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE),
  );
}
describe("confidence-filtered YIN", () => {
  it.each([82.41, 130.81, 220, 440, 880])(
    "detects a known %s Hz pitch within 8 cents",
    (hz) => {
      const pitch = detectPitch(sine(hz), RATE);
      expect(pitch.hz).not.toBeNull();
      expect(Math.abs(1200 * Math.log2(pitch.hz! / hz))).toBeLessThan(8);
      expect(pitch.confidence).toBeGreaterThan(0.85);
    },
  );
  it("handles harmonics and a DC offset", () => {
    const input = Float32Array.from(
      { length: 1024 },
      (_, i) =>
        0.1 +
        0.2 * Math.sin((2 * Math.PI * 220 * i) / RATE) +
        0.15 * Math.sin((2 * Math.PI * 440 * i) / RATE),
    );
    expect(detectPitch(input, RATE).hz).toBeCloseTo(220, 0);
  });
  it("rejects silence and very quiet signals", () => {
    expect(detectPitch(new Float32Array(1024), RATE).hz).toBeNull();
    expect(detectPitch(sine(220, 1024, 0.0002), RATE).hz).toBeNull();
  });
  it("rejects deterministic broadband noise", () => {
    let seed = 12;
    const noise = Float32Array.from({ length: 1024 }, () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return (seed / 2 ** 32 - 0.5) * 0.7;
    });
    expect(detectPitch(noise, RATE).hz).toBeNull();
  });
  it("withholds the score for silence and insufficient pitched audio", () => {
    const a = analyzeSamples(new Float32Array(RATE * 15), RATE);
    expect(a.score).toBeNull();
    expect(a.range).toBeNull();
    const frames = Array.from({ length: 300 }, (_, i) => ({
      time: i * 0.05,
      hz: i < 8 ? 220 : null,
      confidence: i < 8 ? 1 : 0,
      rms: i < 8 ? 0.2 : 0,
    }));
    expect(summarize(frames, 15, 0).score).toBeNull();
  });
  it("does not invent missing stability measurements for continuously changing pitch", () => {
    const frames = Array.from({ length: 300 }, (_, i) => ({
      time: i * 0.05,
      hz: midiHz(48 + i * 0.4),
      confidence: 0.99,
      rms: 0.2,
    }));
    const result = summarize(frames, 15, 0);
    expect(result.metrics.find((m) => m.key === "stability")).toBeUndefined();
    expect(result.score).toBeNull();
  });
  it("measures a stable take and detects clipping separately", () => {
    const frames = Array.from({ length: 300 }, (_, i) => ({
      time: i * 0.05,
      hz: 220,
      confidence: 1,
      rms: 0.2,
    }));
    const result = summarize(frames, 15, 0.02);
    expect(result.score).toBe(100);
    expect(result.warnings.join(" ")).toContain("Clipping");
    expect(result.observations[0].time).toBeGreaterThanOrEqual(0);
    expect(result.range![0]).toBeCloseTo(57);
  });
  it("produces identical measurements for all ten coach personalities and three versions", () => {
    const frames = Array.from({ length: 300 }, (_, i) => ({
      time: i * 0.05,
      hz: 220,
      confidence: 1,
      rms: 0.2,
    }));
    const expected = summarize(frames, 15, 0);
    for (const c of coaches)
      for (const version of ["male", "female", "custom"] as const) {
        expect(
          measuredIntro(
            { ...defaultProfile, coach: c.id, version },
            expected.score,
          ),
        ).toContain("measurements");
        expect(summarize(frames, 15, 0)).toEqual(expected);
      }
  });
});
const exercise = makeExercise("melody", 60, defaultProfile);
function exerciseFrames(
  transpose = 0,
  offset = 0.0,
  individualOffsets: number[] = [],
): PitchFrame[] {
  return Array.from({ length: 360 }, (_, i) => {
    const time = i * 0.05,
      target = exercise.targets.find(
        (t, j) =>
          time >= t.start + offset + (individualOffsets[j] || 0) &&
          time < t.start + offset + (individualOffsets[j] || 0) + t.duration,
      );
    return {
      time,
      hz: target ? midiHz(target.midi + transpose) : null,
      confidence: target ? 1 : 0,
      rms: target ? 0.2 : 0,
    };
  });
}
describe("defined exercise scoring", () => {
  it("scores correct pitches and onsets", () => {
    const a = scoreExercise(exerciseFrames(), exercise);
    expect(a.score).toBeGreaterThanOrEqual(98);
    expect(a.metrics.find((m) => m.key === "timing")?.value).toBeLessThan(51);
  });
  it("scores wrong pitches below correct ones", () => {
    expect(scoreExercise(exerciseFrames(5), exercise).score).toBeLessThan(25);
  });
  it("allows a uniform recording latency without hiding it", () => {
    const a = scoreExercise(exerciseFrames(0, 0.35), exercise);
    expect(a.score).toBeGreaterThanOrEqual(98);
    expect(a.metrics.find((m) => m.key === "latency")?.value).toBeCloseTo(
      350,
      -1,
    );
  });
  it("penalises inconsistent timing after global offset correction", () => {
    const regular = scoreExercise(exerciseFrames(), exercise),
      uneven = scoreExercise(
        exerciseFrames(0, 0, [0, 0.1, -0.1, 0.1, -0.1, 0.1]),
        exercise,
      );
    expect(uneven.score).toBeLessThan(regular.score!);
  });
  it("withholds when too little target audio exists", () => {
    expect(
      scoreExercise(
        exerciseFrames().map((f, i) => ({ ...f, hz: i < 70 ? f.hz : null })),
        exercise,
      ).score,
    ).toBeNull();
  });
  it("keeps targets within the singer’s range independent of presentation", () => {
    for (const kind of ["match", "hold", "melody"] as const) {
      const p = { ...defaultProfile, low: 55, high: 65 };
      const plan = makeExercise(kind, 80, p);
      expect(plan.targets.every((t) => t.midi >= 55 && t.midi <= 65)).toBe(
        true,
      );
    }
    expect(() => makeExercise("melody", 60, { low: 60, high: 62 })).toThrow(
      "comfortable range",
    );
  });
});
