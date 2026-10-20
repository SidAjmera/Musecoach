"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined } from "lucide-react";
import { Session, ExerciseKind } from "@/lib/types";
import { exerciseKey, exerciseInfo, noteName } from "@/lib/exercises";

const groupKey = (s: Session) =>
  `${s.analysis.version}:${exerciseKey(s.analysis.exercise)}`;
export default function ProgressTrend({ sessions }: { sessions: Session[] }) {
  const [selected, setSelected] = useState(""),
    [metric, setMetric] = useState("score");
  const groups = Array.from(
    new Set(sessions.filter((s) => s.analysis.exercise).map(groupKey)),
  );
  const group = groups.includes(selected) ? selected : groups[0];
  const attempts = sessions
    .filter((s) => !!s.analysis.exercise && groupKey(s) === group)
    .reverse();
  const metrics = Array.from(
    new Map(
      attempts.flatMap((s) => s.analysis.metrics).map((m) => [m.key, m]),
    ).values(),
  );
  const key =
    metric === "score" || metrics.some((m) => m.key === metric)
      ? metric
      : "score";
  const definition = metrics.find((m) => m.key === key),
    label = definition?.label || "Exercise score",
    unit = definition?.unit || "out of 100";
  const values = attempts.flatMap((s) => {
    const value =
      key === "score"
        ? s.analysis.score
        : s.analysis.metrics.find((m) => m.key === key)?.value;
    return value !== null && value !== undefined ? [{ id: s.id, value }] : [];
  });
  const min = Math.min(0, ...values.map((p) => p.value)),
    max = Math.max(key === "score" ? 100 : 1, ...values.map((p) => p.value));
  const y = (value: number) => 150 - ((value - min) / (max - min)) * 115;
  return (
    <section className="panel">
      <h3>Compare like with like</h3>
      <p className="small muted">
        Only the same exercise, starting note, timing, and analysis version are
        comparable. Free-singing takes are not ranked against different songs.
      </p>
      {groups.length ? (
        <>
          <div className="trend-controls">
            <label>
              Exercise reference
              <select
                value={group}
                onChange={(e) => setSelected(e.target.value)}
              >
                {groups.map((g) => {
                  const s =
                    attempts.find((s) => groupKey(s) === g) ||
                    sessions.find((s) => groupKey(s) === g)!;
                  return (
                    <option key={g} value={g}>
                      {s.analysis.exercise?.name ||
                        exerciseInfo[s.context as ExerciseKind].label}{" "}
                      · {noteName(s.analysis.exercise!.base)} ·{" "}
                      {s.analysis.version}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Measured trend
              <select value={key} onChange={(e) => setMetric(e.target.value)}>
                <option value="score">Exercise score</option>
                {metrics.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {values.length >= 2 ? (
            <>
              <svg
                className="trend-chart"
                viewBox="0 0 720 180"
                role="img"
                aria-label={`${label}, ${unit}, oldest to newest: ${values.map((p) => p.value).join(", ")}`}
              >
                <line
                  x1="30"
                  x2="690"
                  y1="150"
                  y2="150"
                  stroke="currentColor"
                  opacity=".2"
                />
                <polyline
                  points={values
                    .map(
                      (p, i) =>
                        `${30 + (i / (values.length - 1)) * 660},${y(p.value)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                />
                {values.map((p, i) => (
                  <g key={p.id}>
                    <circle
                      cx={30 + (i / (values.length - 1)) * 660}
                      cy={y(p.value)}
                      r="5"
                      fill="var(--accent)"
                    />
                    <text
                      x={30 + (i / (values.length - 1)) * 660}
                      y={y(p.value) - 12}
                      textAnchor="middle"
                    >
                      {p.value}
                    </text>
                  </g>
                ))}
              </svg>
              <p className="small muted">
                {label} · {unit} · oldest → newest. Missing measurements are
                omitted. Differences can reflect recording conditions as well as
                practice.
              </p>
            </>
          ) : (
            <p className="empty-inline">
              Record this same exercise again to see your first comparison.
            </p>
          )}
        </>
      ) : (
        <div className="empty-state compact">
          <ChartNoAxesCombined size={32} />
          <h3>Your progress needs a beginning.</h3>
          <p>
            Complete a guided exercise, then repeat it with the same reference
            to see a meaningful comparison.
          </p>
          <Link href="/practice" className="button secondary">
            Find an exercise <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}
