import { expect, it } from "vitest";
import { practicePlan } from "../../lib/practice-plan";
import { defaultProfile, type Session, type Metric } from "../../lib/types";
import { ANALYSIS_VERSION } from "../../lib/analysis";
import { exerciseSpan } from "../../lib/exercises";

const metric = (key: string, score: number): Metric => ({
  key,
  score,
  label: key,
  value: score,
  unit: "test",
});
function take(
  metrics: Metric[] = [],
  overrides: Partial<Session["analysis"]> = {},
  id = "take-1",
): Session {
  return {
    id,
    date: "2026-10-20T10:00:00.000Z",
    title: "Fixture take",
    context: "free",
    audioSaved: false,
    analysis: {
      version: ANALYSIS_VERSION,
      duration: 16,
      frames: [],
      voicedSeconds: 10,
      coverage: 0.6,
      range: [55, 62],
      metrics,
      score: 50,
      warnings: [],
      strengths: [],
      improvements: ["Leave a clear gap between notes."],
      observations: [],
      recommendation: "hold",
      formula: "fixture",
      ...overrides,
    },
  };
}
it("offers a baseline without inventing a weakness when history is empty or old", () => {
  for (const sessions of [
    [],
    [take([metric("accuracy", 10)], { version: "yin-1.0" })],
  ]) {
    const plan = practicePlan(sessions, defaultProfile);
    expect(plan.focus).toBe("baseline");
    expect(plan.evidence).toEqual([]);
  }
});
it("targets the lowest supported skill and carries the measured pointers", () => {
  const plan = practicePlan(
    [
      take([
        metric("accuracy", 90),
        metric("timing", 35),
        metric("stability", 80),
      ]),
    ],
    defaultProfile,
  );
  expect(plan.focus).toBe("timing");
  expect(plan.exercises).toContain("short-pulses");
  expect(plan.pointers).toEqual(["Leave a clear gap between notes."]);
  expect(plan.evidence).toEqual([
    { sessionId: "take-1", label: "Separated-note timing", score: 35 },
  ]);
});
it("does not turn a missing measurement into a zero", () => {
  expect(
    practicePlan([take([metric("accuracy", 75)])], defaultProfile).focus,
  ).toBe("accuracy");
  expect(practicePlan([take([])], defaultProfile).focus).toBe("baseline");
});
it("treats a measured zero as real evidence", () => {
  expect(
    practicePlan(
      [take([metric("accuracy", 0), metric("stability", 90)])],
      defaultProfile,
    ).focus,
  ).toBe("accuracy");
});
it("uses the median of recent evidence rather than one outlier", () => {
  const sessions = [95, 92, 0].map((score, i) =>
    take([metric("accuracy", score), metric("timing", 65)], {}, `take-${i}`),
  );
  expect(practicePlan(sessions, defaultProfile).focus).toBe("timing");
});
it("never suggests an exercise outside the current comfortable range", () => {
  const profile = { ...defaultProfile, low: 60, high: 61 };
  const plan = practicePlan([take([metric("accuracy", 25)])], profile);
  expect(plan.exercises.length).toBeGreaterThan(0);
  expect(plan.exercises.every((kind) => exerciseSpan(kind) <= 1)).toBe(true);
});
it("prioritises signal recovery instead of diagnosing a skill from bad input", () => {
  for (const analysis of [
    { coverage: 0.02, voicedSeconds: 0.3 },
    { warnings: ["Clipping detected. Move back."] },
  ]) {
    const plan = practicePlan(
      [take([metric("accuracy", 10)], analysis)],
      defaultProfile,
    );
    expect(plan.focus).toBe("baseline");
    expect(plan.evidence).toEqual([]);
  }
});
it("ignores invalid scores and consolidates when supported indicators are strong", () => {
  expect(
    practicePlan(
      [take([metric("accuracy", NaN), metric("timing", 101)])],
      defaultProfile,
    ).focus,
  ).toBe("baseline");
  const plan = practicePlan(
    [take([metric("accuracy", 90), metric("stability", 88)])],
    defaultProfile,
  );
  expect(plan.focus).toBe("consolidate");
  expect(plan.exercises).toContain("scale");
});
