import { coaches } from "./coaches";
import { exerciseKinds } from "./exercises";
import {
  Profile,
  Session,
  Exercise,
  Metric,
  PitchFrame,
  Observation,
} from "./types";

export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export const MAX_BACKUP_SESSIONS = 1000;
export interface HistoryBackup {
  schema: "musecoach-backup";
  version: 1;
  exportedAt: string;
  audioIncluded: false;
  profile: Profile;
  sessions: Session[];
}
const invalid = (): never => {
  throw new Error(
    "This file is not a supported Musecoach backup. Choose a backup downloaded from Progress with up to 1,000 sessions.",
  );
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, empty = true): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    return invalid();
  return value;
}
function number(value: unknown, low: number, high: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < low ||
    value > high
  )
    return invalid();
  return value;
}
function integer(value: unknown, low: number, high: number): number {
  const n = number(value, low, high);
  return Number.isInteger(n) ? n : invalid();
}
function boolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}
function list<T>(
  value: unknown,
  max: number,
  parse: (item: unknown) => T,
): T[] {
  if (!Array.isArray(value) || value.length > max) return invalid();
  return value.map(parse);
}
function oneOf<T extends string>(value: unknown, choices: readonly T[]): T {
  return typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : invalid();
}
function date(value: unknown): string {
  const raw = text(value, 50, false);
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : invalid();
}
function profile(value: unknown): Profile {
  const p = object(value),
    low = integer(p.low, 36, 88),
    high = integer(p.high, low, 88);
  return {
    name: text(p.name, 120),
    experience: oneOf(p.experience, ["beginner", "intermediate", "advanced"]),
    goals: list(p.goals, 20, (v) => text(v, 120)),
    completedGoals: list(p.completedGoals, 20, (v) => text(v, 120)),
    favoriteExercises:
      p.favoriteExercises === undefined
        ? []
        : [
            ...new Set(
              list(p.favoriteExercises, 100, (v) => oneOf(v, exerciseKinds)),
            ),
          ],
    genres: list(p.genres, 20, (v) => text(v, 120)),
    coach: oneOf(
      p.coach,
      coaches.map((c) => c.id),
    ),
    version: oneOf(p.version, ["male", "female", "custom"]),
    appearance: oneOf(p.appearance, ["masculine", "feminine", "androgynous"]),
    pronouns: text(p.pronouns, 80),
    voice: text(p.voice, 240),
    register: oneOf(p.register, ["low", "middle", "high"]),
    low,
    high,
    rangeSet: boolean(p.rangeSet),
    rangeProvisional: boolean(p.rangeProvisional),
    theme: oneOf(p.theme, ["light", "dark"]),
  };
}
function exercise(value: unknown): Exercise {
  const e = object(value),
    duration = number(e.duration, 15, 60);
  let previousEnd = 0;
  const targets = list(e.targets, 40, (raw) => {
    const t = object(raw),
      start = number(t.start, previousEnd, duration),
      length = number(t.duration, 0.05, duration);
    if (start + length > duration + 1e-6) return invalid();
    previousEnd = start + length;
    return { midi: integer(t.midi, 0, 127), start, duration: length };
  });
  if (!targets.length) return invalid();
  return {
    kind: oneOf(e.kind, exerciseKinds),
    base: integer(e.base, 0, 127),
    duration,
    targets,
    ...(e.name === undefined ? {} : { name: text(e.name, 90, false) }),
    ...(e.source === undefined
      ? {}
      : { source: oneOf(e.source, ["ai"] as const) }),
    ...(e.rationale === undefined
      ? {}
      : { rationale: text(e.rationale, 500, false) }),
  };
}
function session(value: unknown): Session {
  const s = object(value),
    a = object(s.analysis),
    duration = number(a.duration, 14.85, 60.15);
  const id = text(s.id, 100, false);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return invalid();
  const context = oneOf(s.context, ["free", ...exerciseKinds]);
  const reference = a.exercise === undefined ? undefined : exercise(a.exercise);
  if (
    (context !== "free" && reference?.kind !== context) ||
    (context === "free" && reference)
  )
    return invalid();
  let lastTime = -1;
  const frames = list<PitchFrame>(a.frames, 1300, (raw) => {
    const frame = object(raw),
      time = number(frame.time, 0, duration + 0.15);
    if (time <= lastTime) return invalid();
    lastTime = time;
    return {
      time,
      hz: frame.hz === null ? null : number(frame.hz, 20, 4000),
      confidence: number(frame.confidence, 0, 1),
      rms: number(frame.rms, 0, 4),
    };
  });
  const metrics = list<Metric>(a.metrics, 30, (raw) => {
    const m = object(raw);
    return {
      key: text(m.key, 60, false),
      label: text(m.label, 160, false),
      value: number(m.value, -1e6, 1e6),
      unit: text(m.unit, 100),
      ...(m.score === undefined ? {} : { score: number(m.score, 0, 100) }),
    };
  });
  const observations = list<Observation>(a.observations, 30, (raw) => {
    const o = object(raw);
    return { time: number(o.time, 0, duration), text: text(o.text, 1600) };
  });
  let range: [number, number] | null = null;
  if (a.range !== null) {
    if (!Array.isArray(a.range) || a.range.length !== 2) return invalid();
    const low = number(a.range[0], 0, 127);
    range = [low, number(a.range[1], low, 127)];
  }
  const strings = (value: unknown) =>
    list(value, 30, (item) => text(item, 1600));
  return {
    id,
    date: date(s.date),
    title: text(s.title, 200),
    context,
    audioSaved: false,
    analysis: {
      version: text(a.version, 60, false),
      duration,
      frames,
      voicedSeconds: number(a.voicedSeconds, 0, duration + 0.15),
      coverage: number(a.coverage, 0, 1.01),
      range,
      metrics,
      score: a.score === null ? null : number(a.score, 0, 100),
      warnings: strings(a.warnings),
      strengths: strings(a.strengths),
      improvements: strings(a.improvements),
      observations,
      recommendation: oneOf(a.recommendation, exerciseKinds),
      formula: text(a.formula, 4000),
      ...(reference ? { exercise: reference } : {}),
    },
  };
}

/** Canonical reconstruction prevents credentials, audio and arbitrary storage keys entering a backup. */
export function validateHistoryBackup(value: unknown): HistoryBackup {
  const data = object(value);
  if (
    data.schema !== "musecoach-backup" ||
    data.version !== 1 ||
    data.audioIncluded !== false
  )
    return invalid();
  const sessions = list(data.sessions, MAX_BACKUP_SESSIONS, session);
  if (new Set(sessions.map((s) => s.id)).size !== sessions.length)
    return invalid();
  return {
    schema: "musecoach-backup",
    version: 1,
    exportedAt: date(data.exportedAt),
    audioIncluded: false,
    profile: profile(data.profile),
    sessions,
  };
}
export function historyBackupJSON(
  currentProfile: Profile,
  sessions: Session[],
): string {
  const clean = validateHistoryBackup({
    schema: "musecoach-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    audioIncluded: false,
    profile: currentProfile,
    sessions,
  });
  const json = JSON.stringify(clean);
  if (new Blob([json]).size > MAX_BACKUP_BYTES)
    throw new Error(
      "This history exceeds the 64 MB backup limit. Download progress CSV or individual audio files instead.",
    );
  return json;
}
export function parseHistoryBackup(raw: string): HistoryBackup {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES)
    throw new Error("Choose a Musecoach backup smaller than 64 MB.");
  try {
    return validateHistoryBackup(JSON.parse(raw.replace(/^\uFEFF/, "")));
  } catch {
    return invalid();
  }
}
