import { exerciseInfo, noteName } from "./exercises";
import { Session } from "./types";

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : '""';
  // Session titles are user-entered text. Prevent spreadsheet formula execution.
  const safe = /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(value)
    ? "'" + value
    : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Explicit allowlist: never serialise a session object or browser storage wholesale. */
export function progressCSV(sessions: Session[]): string {
  const headers = [
    "date",
    "title",
    "context",
    "reference_name",
    "analysis_version",
    "duration_seconds",
    "practice_score_out_of_100",
    "confident_pitch_coverage_percent",
    "pitch_accuracy_percent",
    "steadiness_deviation_cents",
    "onset_timing_deviation_ms",
    "recording_level_dbfs",
    "target_coverage_percent",
    "detected_low_note",
    "detected_high_note",
  ];
  const rows = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => {
      const analysis = session.analysis;
      const metric = (key: string) =>
        analysis.metrics.find((m) => m.key === key)?.value;
      return [
        session.date,
        session.title,
        session.context === "free" ? "Free singing" : "Guided exercise",
        analysis.exercise?.name ||
          (session.context === "free"
            ? ""
            : exerciseInfo[session.context].label),
        analysis.version,
        Math.round(analysis.duration * 10) / 10,
        analysis.score,
        Math.round(analysis.coverage * 1000) / 10,
        metric("accuracy"),
        metric("stability"),
        metric("timing"),
        metric("inputLevel"),
        metric("targetCoverage"),
        analysis.range ? noteName(analysis.range[0]) : "",
        analysis.range ? noteName(analysis.range[1]) : "",
      ]
        .map(csvCell)
        .join(",");
    });
  return (
    "\uFEFF" + [headers.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n"
  );
}
