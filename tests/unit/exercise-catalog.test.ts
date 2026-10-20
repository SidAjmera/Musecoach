import { describe, expect, it } from "vitest";
import {
  exerciseKinds,
  exerciseKey,
  makeExercise,
  provisionalPracticeWindow,
} from "../../lib/exercises";
import { defaultProfile } from "../../lib/types";

describe("100-exercise library", () => {
  it("never adopts an inverted or unsupported provisional practice window", () => {
    expect(provisionalPracticeWindow([33, 35])).toBeUndefined();
    expect(provisionalPracticeWindow([89, 91])).toBeUndefined();
    expect(provisionalPracticeWindow([NaN, 60])).toBeUndefined();
    expect(provisionalPracticeWindow([33, 40])).toEqual([36, 40]);
    expect(provisionalPracticeWindow([80, 92])).toEqual([80, 88]);
    expect(provisionalPracticeWindow([55.2, 62.8])).toEqual([56, 62]);
  });
  it("contains 100 distinct musical references, not renamed duplicates", () => {
    expect(exerciseKinds).toHaveLength(100);
    const references = exerciseKinds.map((kind) =>
      JSON.stringify(makeExercise(kind, 60, defaultProfile).targets),
    );
    const duplicates = exerciseKinds.filter(
      (_, index) => references.indexOf(references[index]) !== index,
    );
    expect(
      new Set(references).size,
      `Duplicate references: ${duplicates.join(", ")}`,
    ).toBe(100);
  });
  it.each(exerciseKinds)("keeps %s playable and non-overlapping", (kind) => {
    const exercise = makeExercise(kind, 60, defaultProfile);
    exercise.targets.forEach((target, index) => {
      expect(target.duration).toBeGreaterThan(0);
      expect(target.start + target.duration).toBeLessThanOrEqual(
        exercise.duration,
      );
      if (index > 0) {
        const previous = exercise.targets[index - 1];
        expect(target.start).toBeGreaterThan(
          previous.start + previous.duration,
        );
      }
    });
    expect(exerciseKey(exercise)).not.toBe(
      exerciseKey(makeExercise(kind, 59, defaultProfile)),
    );
  });
});
