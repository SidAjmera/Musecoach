export type CoachId =
  | "Sunny"
  | "Jules"
  | "Nova"
  | "Sage"
  | "Rex"
  | "Cleo"
  | "Theo"
  | "Lola"
  | "Ash"
  | "Kai";
export type ExerciseKind =
  | "match"
  | "hold"
  | "melody"
  | "intervals"
  | "scale"
  | "arpeggio"
  | "step-up"
  | "step-down"
  | "thirds"
  | "minor-thirds"
  | "fourths"
  | "fifths"
  | "octaves"
  | "minor-scale"
  | "major-octave"
  | "descending-scale"
  | "pentatonic"
  | "chromatic"
  | "minor-arpeggio"
  | "descending-arpeggio"
  | "major-triad"
  | "minor-triad"
  | "three-note-turn"
  | "do-re-mi"
  | "pitch-memory"
  | "short-pulses"
  | "long-short"
  | "offbeat"
  | "rest-reset"
  | "descending-thirds";
export interface Profile {
  name: string;
  experience: string;
  goals: string[];
  completedGoals: string[];
  genres: string[];
  coach: CoachId;
  version: "female" | "male" | "custom";
  appearance: "feminine" | "masculine" | "androgynous";
  pronouns: string;
  voice: string;
  register: "low" | "middle" | "high";
  low: number;
  high: number;
  rangeSet: boolean;
  rangeProvisional: boolean;
  theme: "light" | "dark";
}
export interface PitchFrame {
  time: number;
  hz: number | null;
  confidence: number;
  rms: number;
}
export interface Target {
  start: number;
  duration: number;
  midi: number;
}
export interface Exercise {
  kind: ExerciseKind;
  base: number;
  targets: Target[];
  duration: number;
}
export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: string;
  score?: number;
}
export interface Observation {
  time: number;
  text: string;
}
export interface Analysis {
  version: string;
  duration: number;
  frames: PitchFrame[];
  voicedSeconds: number;
  coverage: number;
  range: [number, number] | null;
  metrics: Metric[];
  score: number | null;
  warnings: string[];
  strengths: string[];
  improvements: string[];
  observations: Observation[];
  recommendation: ExerciseKind;
  formula: string;
  exercise?: Exercise;
}
export interface Session {
  id: string;
  date: string;
  title: string;
  context: "free" | ExerciseKind;
  analysis: Analysis;
  audioSaved: boolean;
}
export const defaultProfile: Profile = {
  name: "",
  experience: "beginner",
  goals: ["Pitch stability", "Confidence"],
  completedGoals: [],
  genres: [],
  coach: "Sunny",
  version: "female",
  appearance: "feminine",
  pronouns: "she/her",
  voice: "",
  register: "high",
  low: 48,
  high: 72,
  rangeSet: false,
  rangeProvisional: false,
  theme: "light",
};
