import { Exercise, ExerciseKind, Profile } from "./types";
export const exerciseInfo = {
  match: {
    name: "Find your note",
    label: "Match a note",
    description: "Listen, hum, and find the centre of a comfortable note.",
    focus: "Pitch accuracy",
    icon: "◎",
  },
  hold: {
    name: "Steady as you go",
    label: "Hold a note",
    description: "Keep a gentle note going and explore its natural movement.",
    focus: "Pitch stability",
    icon: "〰",
  },
  melody: {
    name: "A little melodic adventure",
    label: "Follow a short melody",
    description: "Follow six original notes, one easy phrase at a time.",
    focus: "Pitch & timing",
    icon: "♫",
  },
};
export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const hzMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export function noteName(m: number) {
  const n = Math.round(m);
  return (
    ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
      ((n % 12) + 12) % 12
    ] +
    (Math.floor(n / 12) - 1)
  );
}
export function makeExercise(
  kind: ExerciseKind,
  base: number,
  profile: Pick<Profile, "low" | "high">,
): Exercise {
  const span = kind === "melody" ? 4 : 0;
  const b = Math.max(profile.low, Math.min(base, profile.high - span));
  if (profile.high - profile.low < span)
    throw new Error(
      "Choose a comfortable range of at least five semitones for this melody.",
    );
  const targets =
    kind === "match"
      ? [3, 7, 11, 15].map((start) => ({ start, duration: 2.5, midi: b }))
      : kind === "hold"
        ? [3, 11].map((start) => ({ start, duration: 5, midi: b }))
        : [0, 2, 4, 2, 0, 0].map((n, i) => ({
            start: 3 + i * 2,
            duration: 1.7,
            midi: b + n,
          }));
  return { kind, base: b, targets, duration: 18 };
}
export function exerciseKey(e?: Exercise) {
  return e
    ? `${e.kind}:${e.base}:${e.targets.map((t) => `${t.start}/${t.duration}/${t.midi}`).join(",")}`
    : "free";
}
