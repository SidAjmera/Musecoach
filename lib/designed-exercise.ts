import { Exercise, Profile } from "./types";

export const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    rationale: { type: "string" },
    targets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          midi: { type: "integer" },
          start: { type: "number" },
          duration: { type: "number" },
        },
        required: ["midi", "start", "duration"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "rationale", "targets"],
  additionalProperties: false,
};

/** Validate untrusted model output before playback, recording or persistence. */
export function validateDesign(
  value: unknown,
  profile: Pick<Profile, "low" | "high">,
): Exercise {
  const fail = () => {
    throw new Error(
      "The coach's exercise did not pass the range and timing checks. Try again or use your suggested library exercises.",
    );
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !["name", "rationale", "targets"].includes(key),
    ) ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 90 ||
    typeof data.rationale !== "string" ||
    !data.rationale.trim() ||
    data.rationale.length > 500 ||
    !Array.isArray(data.targets) ||
    data.targets.length < 2 ||
    data.targets.length > 10 ||
    !Number.isInteger(profile.low) ||
    !Number.isInteger(profile.high) ||
    profile.low < 36 ||
    profile.high > 88 ||
    profile.low > profile.high
  )
    return fail();
  let end = 0,
    total = 0;
  const targets = data.targets.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
    const t = raw as Record<string, unknown>;
    if (
      Object.keys(t).some(
        (key) => !["midi", "start", "duration"].includes(key),
      ) ||
      typeof t.midi !== "number" ||
      !Number.isInteger(t.midi) ||
      t.midi < profile.low ||
      t.midi > profile.high ||
      typeof t.start !== "number" ||
      !Number.isFinite(t.start) ||
      t.start < 3 ||
      typeof t.duration !== "number" ||
      !Number.isFinite(t.duration) ||
      t.duration < 0.4 ||
      t.duration > 5 ||
      t.start + t.duration > 17.8 ||
      (end > 0 && t.start < end + 0.15 - 1e-6)
    )
      return fail();
    end = t.start + t.duration;
    total += t.duration;
    return { midi: t.midi, start: t.start, duration: t.duration };
  });
  if (total < 5) return fail();
  return {
    kind: "melody",
    base: targets[0].midi,
    targets,
    duration: 18,
    name: data.name.trim(),
    rationale: data.rationale.trim(),
    source: "ai",
  };
}

export const DESIGN_STORAGE_KEY = "musecoach-designed-exercise";
export function readDesignedExercise(
  profile: Pick<Profile, "low" | "high">,
): Exercise {
  const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
  if (!raw)
    throw new Error(
      "Design an exercise in Practice first. Your earlier design may belong to another browser or have been cleared.",
    );
  const saved = JSON.parse(raw);
  return validateDesign(
    { name: saved.name, rationale: saved.rationale, targets: saved.targets },
    profile,
  );
}
