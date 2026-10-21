import { Exercise } from "./types";

export const exerciseSpeeds = [0.6, 0.75, 1, 1.2] as const;
/** Keep the three-second count-in fixed; stretch notes and rests together. */
export function withTempo(reference: Exercise, speed: number): Exercise {
  if (!exerciseSpeeds.includes(speed as (typeof exerciseSpeeds)[number]))
    throw new Error("Choose a supported exercise speed.");
  const duration = 3 + (reference.duration - 3) / speed;
  if (duration < 15 || duration > 60)
    throw new Error(
      "This speed would put the reference outside 15–60 seconds.",
    );
  if (speed === 1) return reference;
  return {
    ...reference,
    speed,
    duration,
    targets: reference.targets.map((t) => ({
      ...t,
      start: 3 + (t.start - 3) / speed,
      duration: t.duration / speed,
    })),
  };
}
