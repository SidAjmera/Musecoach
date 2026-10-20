import { describe, expect, it } from "vitest";
import { exerciseKinds, exerciseKey, makeExercise } from "../../lib/exercises";
import { defaultProfile } from "../../lib/types";

describe("30-exercise library", () => {
  it("contains 30 distinct musical references, not renamed duplicates", () => {
    expect(exerciseKinds).toHaveLength(30);
    const references = exerciseKinds.map((kind) =>
      JSON.stringify(makeExercise(kind, 60, defaultProfile).targets),
    );
    expect(new Set(references).size).toBe(30);
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
