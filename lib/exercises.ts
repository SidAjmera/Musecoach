import { Exercise, ExerciseKind, Profile } from "./types";
import { extraExercises } from "./extra-exercises";
export interface ExerciseDefinition {
  name: string;
  label: string;
  description: string;
  category: string;
  focus: string;
  icon: string;
  pattern: number[];
  starts?: number[];
  durations?: number[];
}
function define(
  label: string,
  description: string,
  category: string,
  focus: string,
  pattern: number[],
  starts?: number[],
  durations?: number[],
  name = label,
): ExerciseDefinition {
  const icons: Record<string, string> = {
    Basics: "◎",
    Scales: "⋰",
    Intervals: "↗",
    Arpeggios: "♬",
    Phrases: "♫",
    Timing: "◷",
  };
  return {
    name,
    label,
    description,
    category,
    focus,
    icon: icons[category],
    pattern,
    starts,
    durations,
  };
}
export const exerciseInfo: Record<ExerciseKind, ExerciseDefinition> = {
  match: define(
    "Match a note",
    "Listen, hum, and find the centre of a comfortable note.",
    "Basics",
    "Pitch accuracy",
    [0, 0, 0, 0],
    [3, 7, 11, 15],
    [2.5, 2.5, 2.5, 2.5],
    "Find your note",
  ),
  hold: define(
    "Hold a note",
    "Keep a gentle note going and explore its natural movement.",
    "Basics",
    "Pitch stability",
    [0, 0],
    [3, 11],
    [5, 5],
    "Steady as you go",
  ),
  melody: define(
    "Follow a short melody",
    "Follow six original notes, one easy phrase at a time.",
    "Phrases",
    "Pitch & timing",
    [0, 2, 4, 2, 0, 0],
    [3, 5, 7, 9, 11, 13],
    undefined,
    "A little melodic adventure",
  ),
  intervals: define(
    "Interval echoes",
    "Echo a comfortable third and fifth, returning to your starting note.",
    "Intervals",
    "Pitch transitions",
    [0, 4, 0, 7, 4, 0],
    [3, 5, 7, 9, 11, 13],
    undefined,
    "Find the space between notes",
  ),
  scale: define(
    "Five-note scale",
    "Climb five notes of a major-scale pattern, then come gently back down.",
    "Scales",
    "Pitch coordination",
    [0, 2, 4, 5, 7, 5, 4, 2, 0],
    undefined,
    undefined,
    "Five steps, there and back",
  ),
  arpeggio: define(
    "Arpeggio flow",
    "Explore the root, third, and fifth of a chord in a returning pattern.",
    "Arpeggios",
    "Note separation",
    [0, 4, 7, 4, 0, 4, 7, 0],
    undefined,
    undefined,
    "Let the chord unfold",
  ),
  "step-up": define(
    "Step-up echoes",
    "Move up a whole step, return, then explore one further step.",
    "Basics",
    "Whole steps",
    [0, 2, 0, 2, 4, 2],
  ),
  "step-down": define(
    "Step-down echoes",
    "Start a little higher and settle into easy descending whole steps.",
    "Basics",
    "Descending steps",
    [4, 2, 4, 2, 0, 2],
  ),
  thirds: define(
    "Thirds ladder",
    "Pair each starting note with a third above as the pattern rises.",
    "Intervals",
    "Major and minor thirds",
    [0, 4, 2, 5, 4, 7],
  ),
  "minor-thirds": define(
    "Minor-third echoes",
    "Echo a three-semitone leap, with a quiet gap to reset each time.",
    "Intervals",
    "Minor thirds",
    [0, 3, 0, 3, 0, 3],
  ),
  fourths: define(
    "Fourth echoes",
    "Explore a fourth above your starting note, then approach it from a new note.",
    "Intervals",
    "Fourth landings",
    [0, 5, 0, 5, 2, 5],
  ),
  fifths: define(
    "Fifth landings",
    "Aim for a fifth, return through the third, and try another clear landing.",
    "Intervals",
    "Fifth landings",
    [0, 7, 4, 7, 0, 7],
  ),
  octaves: define(
    "Octave echoes",
    "Echo an octave only if both notes feel easy; choose a smaller leap otherwise.",
    "Intervals",
    "Octave orientation",
    [0, 12, 0, 12, 0, 12],
  ),
  "minor-scale": define(
    "Minor five-note scale",
    "Explore a minor five-note pattern and its closer middle step.",
    "Scales",
    "Minor-scale steps",
    [0, 2, 3, 5, 7, 5, 3, 2, 0],
  ),
  "major-octave": define(
    "Octave major scale",
    "Follow eight ascending major-scale notes within a comfortable octave.",
    "Scales",
    "Scale sequence",
    [0, 2, 4, 5, 7, 9, 11, 12],
  ),
  "descending-scale": define(
    "Descending five-note scale",
    "Come down from the fifth, then gently revisit the second and home note.",
    "Scales",
    "Descending coordination",
    [7, 5, 4, 2, 0, 2, 0],
  ),
  pentatonic: define(
    "Pentatonic path",
    "Explore a five-note pentatonic pattern with its wider middle steps.",
    "Scales",
    "Mixed step sizes",
    [0, 2, 4, 7, 9, 7, 4, 2, 0],
  ),
  chromatic: define(
    "Semitone steps",
    "Move in small, defined semitone steps up and back.",
    "Scales",
    "Close pitch spacing",
    [0, 1, 2, 3, 4, 3, 2, 1, 0],
  ),
  "minor-arpeggio": define(
    "Minor arpeggio flow",
    "Explore a minor chord by changing the third in a returning arpeggio.",
    "Arpeggios",
    "Minor chord notes",
    [0, 3, 7, 3, 0, 3, 7, 0],
  ),
  "descending-arpeggio": define(
    "Descending arpeggio",
    "Unfold a chord from the octave down through its fifth and third.",
    "Arpeggios",
    "Descending leaps",
    [12, 7, 4, 0, 4, 0],
  ),
  "major-triad": define(
    "Major-triad echoes",
    "Sing two ascending root-third-fifth groups with clear note changes.",
    "Arpeggios",
    "Major chord pattern",
    [0, 4, 7, 0, 4, 7],
  ),
  "minor-triad": define(
    "Minor-triad echoes",
    "Sing two ascending minor-triad groups and compare their shape.",
    "Arpeggios",
    "Minor chord pattern",
    [0, 3, 7, 0, 3, 7],
  ),
  "three-note-turn": define(
    "Three-note turns",
    "Turn around the middle note, then settle on the lower note.",
    "Phrases",
    "Direction changes",
    [2, 4, 2, 0, 2, 4, 2, 0],
  ),
  "do-re-mi": define(
    "Do–re–mi return",
    "Hear the first three major-scale notes and return through them.",
    "Basics",
    "Three-note orientation",
    [0, 2, 4, 0, 4, 2, 0],
  ),
  "pitch-memory": define(
    "Phrase echo",
    "Listen first, then echo a short phrase with rests between its notes.",
    "Phrases",
    "Phrase recall",
    [0, 5, 2, 7, 4, 0],
    [3, 5.3, 7.6, 9.9, 12.2, 14.5],
    [1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
  ),
  "short-pulses": define(
    "Short note pulses",
    "Sing eight short notes at the same pitch, leaving the defined gaps.",
    "Timing",
    "Repeated onsets",
    [0, 0, 0, 0, 0, 0, 0, 0],
    undefined,
    [0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65],
  ),
  "long-short": define(
    "Long–short pairs",
    "Alternate longer and shorter notes across a simple pitch pattern.",
    "Timing",
    "Uneven note lengths",
    [0, 0, 2, 2, 4, 0],
    [3, 6, 7.5, 10.5, 12, 15],
    [2.1, 0.7, 2.1, 0.7, 2.1, 0.7],
  ),
  offbeat: define(
    "Delayed entries",
    "Wait half a beat after the count-in, then follow the shifted entrances.",
    "Timing",
    "Entry placement",
    [0, 2, 0, 4, 2, 0],
    [3.5, 5.5, 7.5, 9.5, 11.5, 13.5],
    [1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
  ),
  "rest-reset": define(
    "Rest and reset",
    "Leave a longer pause between four comfortable notes and re-enter clearly.",
    "Timing",
    "Rest awareness",
    [0, 2, 0, 4],
    [3, 6.5, 10, 13.5],
    [1.5, 1.5, 1.5, 1.5],
  ),
  "descending-thirds": define(
    "Descending thirds",
    "Explore alternating descending thirds, returning to the starting note.",
    "Intervals",
    "Descending interval shape",
    [7, 4, 5, 2, 4, 0],
  ),
  ...extraExercises,
};
export const exerciseKinds = Object.keys(exerciseInfo) as ExerciseKind[];
export const exerciseCategories = [
  ...new Set(exerciseKinds.map((kind) => exerciseInfo[kind].category)),
];
export const exerciseSpan = (kind: ExerciseKind) =>
  Math.max(...exerciseInfo[kind].pattern);
export const isSequenceExercise = (kind: ExerciseKind) =>
  !["match", "hold"].includes(kind);
export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const hzMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export function provisionalPracticeWindow(
  range: [number, number],
): [number, number] | undefined {
  if (!range.every(Number.isFinite)) return undefined;
  const low = Math.max(36, Math.ceil(range[0]));
  const high = Math.min(88, Math.floor(range[1]));
  return high - low >= 1 ? [low, high] : undefined;
}
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
  const definition = exerciseInfo[kind];
  if (
    !definition ||
    !Number.isFinite(base) ||
    !Number.isFinite(profile.low) ||
    !Number.isFinite(profile.high) ||
    profile.high < profile.low
  )
    throw new Error("Choose a valid exercise and comfortable range.");
  const span = exerciseSpan(kind);
  if (profile.high - profile.low < span)
    throw new Error(
      `Choose a comfortable range spanning at least ${span} semitones for this pattern.`,
    );
  const b = Math.max(profile.low, Math.min(base, profile.high - span));
  const spacing = 14 / definition.pattern.length;
  const targets = definition.pattern.map((offset, i) => ({
    start: definition.starts?.[i] ?? 3 + i * spacing,
    duration:
      definition.durations?.[i] ?? (definition.starts ? 1.7 : spacing - 0.25),
    midi: b + offset,
  }));
  return { kind, base: b, targets, duration: 18 };
}
export function exerciseKey(e?: Exercise) {
  return e
    ? `${e.kind}:${e.base}:${e.song?.id || ""}:${e.targets.map((t) => `${t.start}/${t.duration}/${t.midi}`).join(",")}`
    : "free";
}
