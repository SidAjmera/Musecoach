import { ANALYSIS_VERSION } from "./analysis";
import { exerciseSpan } from "./exercises";
import { ExerciseKind, Profile, Session } from "./types";

export interface PracticePlan {
  focus: "baseline" | "accuracy" | "stability" | "timing" | "consolidate";
  title: string;
  reason: string;
  exercises: ExerciseKind[];
  pointers: string[];
  evidence: { sessionId: string; label: string; score: number }[];
}

/** Suggestions describe available practice evidence, never an overall vocal ability. */
export function practicePlan(
  sessions: Session[],
  profile: Profile,
): PracticePlan {
  const recent = [...sessions]
    .filter((s) => s.analysis.version === ANALYSIS_VERSION)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const latest = recent[0];
  const fit = (kinds: ExerciseKind[]) =>
    [...new Set(kinds)]
      .filter((kind) => exerciseSpan(kind) <= profile.high - profile.low)
      .slice(0, 3);
  const baseline = (reason: string): PracticePlan => ({
    focus: "baseline",
    title: "Start with a comfortable baseline",
    reason,
    exercises: fit(["hold", "match", "melody"]),
    pointers: [],
    evidence: [],
  });
  if (!latest)
    return baseline(
      "Complete a held note and a note-matching exercise so your next suggestions can use measured results.",
    );
  if (latest.analysis.coverage < 0.1 || latest.analysis.voicedSeconds < 1.5)
    return baseline(
      "Your latest take had too little usable pitch to identify a practice focus. Try the microphone check, then a gentle held note.",
    );
  if (
    latest.analysis.warnings.some((warning) =>
      warning.startsWith("Clipping detected"),
    )
  )
    return baseline(
      "Your latest take clipped. Move back or lower input gain, check the microphone, and record a comfortable baseline before choosing a skill focus.",
    );
  const dimensions = [
    {
      key: "accuracy",
      label: "Pitch accuracy",
      kinds: ["match", "step-up", "thirds"],
    },
    {
      key: "stability",
      label: "Pitch steadiness",
      kinds: ["hold", "match", "do-re-mi"],
    },
    {
      key: "timing",
      label: "Separated-note timing",
      kinds: ["short-pulses", "offbeat", "rest-reset"],
    },
  ] as const;
  const measured = dimensions
    .flatMap((dimension) => {
      const evidence = recent.flatMap((session) => {
        if (
          session.analysis.coverage < 0.1 ||
          session.analysis.voicedSeconds < 1.5
        )
          return [];
        const metric = session.analysis.metrics.find(
          (m) => m.key === dimension.key,
        );
        return metric &&
          typeof metric.score === "number" &&
          Number.isFinite(metric.score) &&
          metric.score >= 0 &&
          metric.score <= 100
          ? [
              {
                sessionId: session.id,
                label: dimension.label,
                score: metric.score,
              },
            ]
          : [];
      });
      if (!evidence.length) return [];
      const scores = evidence.map((e) => e.score).sort((a, b) => a - b);
      const middle = Math.floor(scores.length / 2);
      const median =
        scores.length % 2
          ? scores[middle]
          : (scores[middle - 1] + scores[middle]) / 2;
      return [{ ...dimension, evidence, median }];
    })
    .sort((a, b) => a.median - b.median);
  const weakest = measured[0];
  if (!weakest)
    return baseline(
      "Your recent takes do not yet contain enough supported skill measurements. Try a defined note-matching exercise and a held note.",
    );
  const pointers = latest.analysis.improvements.slice(0, 2);
  if (weakest.median >= 80)
    return {
      focus: "consolidate",
      title: "Build on your recent practice",
      reason:
        "The available skill indicators in your recent takes are at least 80/100. Repeat a familiar reference, then try a comfortable scale or chord pattern. This is practice guidance, not a skill certification.",
      exercises: fit([
        latest.analysis.exercise?.kind || "hold",
        "scale",
        "arpeggio",
        "match",
      ]),
      pointers,
      evidence: weakest.evidence,
    };
  return {
    focus: weakest.key,
    title: `Focus on ${weakest.label.toLowerCase()}`,
    reason: `${weakest.label} had the lowest available median indicator (${Math.round(weakest.median)}/100) across up to five recent takes analysed with the current detector. These suggestions target that measured area; different exercises and recording conditions can affect it.`,
    exercises: fit([...weakest.kinds]),
    pointers,
    evidence: weakest.evidence,
  };
}
