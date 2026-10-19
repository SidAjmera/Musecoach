"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
} from "lucide-react";
import { Analysis, Profile, Session } from "@/lib/types";
import { noteName, exerciseInfo } from "@/lib/exercises";
import { getAudio } from "@/lib/storage";
import { previousAttempt } from "@/lib/comparison";
import { measuredIntro } from "@/lib/coaches";
export function PitchChart({ analysis }: { analysis: Analysis }) {
  const pitched = analysis.frames.filter((f) => f.hz),
    midi = (hz: number) => 69 + 12 * Math.log2(hz / 440),
    all = [
      ...pitched.map((f) => midi(f.hz!)),
      ...(analysis.exercise?.targets.map((t) => t.midi) || []),
    ],
    low = Math.floor(Math.min(...all, 60)) - 2,
    high = Math.ceil(Math.max(...all, 64)) + 2;
  const x = (t: number) => 48 + (t / analysis.duration) * 690,
    y = (n: number) => 154 - ((n - low) / (high - low)) * 125;
  let d = "",
    last = -1;
  for (const f of analysis.frames) {
    if (!f.hz) {
      last = -1;
      continue;
    }
    d += `${last < 0 ? "M" : "L"}${x(f.time).toFixed(1)},${y(midi(f.hz)).toFixed(1)} `;
    last = f.time;
  }
  return (
    <div className="pitch-chart">
      <svg
        viewBox="0 0 760 192"
        role="img"
        aria-label={
          analysis.range
            ? `Pitch timeline over ${analysis.duration.toFixed(1)} seconds. Middle 90 percent of detected pitches: ${noteName(analysis.range[0])} to ${noteName(analysis.range[1])}. Gaps mean no confident pitch.`
            : "Pitch timeline: no confident pitch detected."
        }
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const n = low + ((high - low) * i) / 4;
          return (
            <g key={i}>
              <line
                x1="48"
                x2="740"
                y1={y(n)}
                y2={y(n)}
                stroke="currentColor"
                opacity=".09"
              />
              <text x="4" y={y(n) + 4}>
                {noteName(n)}
              </text>
            </g>
          );
        })}
        {analysis.exercise?.targets.map((t, i) => (
          <line
            key={i}
            x1={x(t.start)}
            x2={x(t.start + t.duration)}
            y1={y(t.midi)}
            y2={y(t.midi)}
            stroke="#bb833a"
            strokeWidth="3"
            strokeDasharray="5 4"
          />
        ))}
        <path
          d={d}
          fill="none"
          stroke="#598675"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((n) => (
          <text
            key={n}
            x={x(n * analysis.duration)}
            y="182"
            textAnchor="middle"
          >
            {Math.round(n * analysis.duration)}s
          </text>
        ))}
      </svg>
      <p className="small muted">
        Green: detected pitch · Gaps: low confidence
        {analysis.exercise ? " · Dashed gold: defined targets" : ""}. Solo
        singing works best; pitch estimates may include octave errors.
      </p>
    </div>
  );
}
export default function Review({
  session,
  sessions,
  profile,
  audio,
  onPractice,
  onDelete,
  onDeleteAudio,
  onRange,
}: {
  session: Session;
  sessions: Session[];
  profile: Profile;
  audio?: Blob;
  onPractice: (kind: Analysis["recommendation"]) => void;
  onDelete?: () => void;
  onDeleteAudio?: () => void;
  onRange?: (low: number, high: number) => void;
}) {
  const a = session.analysis,
    previous = previousAttempt(session, sessions),
    [url, setUrl] = useState(""),
    [audioError, setAudioError] = useState(""),
    player = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = "";
    setUrl("");
    (async () => {
      try {
        const b =
          audio ||
          (session.audioSaved ? await getAudio(session.id) : undefined);
        if (b && active) {
          objectUrl = URL.createObjectURL(b);
          setUrl(objectUrl);
        }
      } catch {
        setAudioError("Saved audio could not be loaded.");
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audio, session.id, session.audioSaved]);
  const metricDiff =
    previous && a.score !== null && previous.analysis.score !== null
      ? a.score - previous.analysis.score
      : null;
  return (
    <div className="review-stack">
      <div className="review-banner">
        <div>
          <span className="eyebrow">YOUR TAKE, EXPLAINED</span>
          <h2>
            {a.score === null
              ? "A little more sound, a clearer picture."
              : "Every take tells you something."}
          </h2>
          <p>{measuredIntro(profile, a.score)}</p>
        </div>
        <div className="score-circle">
          <strong>{a.score ?? "—"}</strong>
          <span>{a.score === null ? "Not scored" : "out of 100"}</span>
        </div>
      </div>
      <div className="notice small">
        {session.context === "free"
          ? "Free-singing practice indicator · not an objective rating of talent."
          : "Guided exercise score · compared with a defined reference."}{" "}
        {metricDiff !== null && (
          <strong>
            {metricDiff > 0 ? "+" : ""}
            {metricDiff} points from your previous comparable attempt.
          </strong>
        )}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h3>Listen back</h3>
          <span className="tag">{a.duration.toFixed(1)} seconds</span>
        </div>
        {url ? (
          <audio
            ref={player}
            src={url}
            controls
            preload="metadata"
            onError={() =>
              setAudioError(
                "This browser could not play the saved audio. Try a different browser.",
              )
            }
          />
        ) : (
          <p className="muted">
            Audio wasn’t saved with this session. Measurements are still here;
            timestamp playback needs saved audio.
          </p>
        )}
        {audioError && (
          <p role="alert" className="error">
            {audioError}
          </p>
        )}
        {session.audioSaved && onDeleteAudio && (
          <button className="text-button danger" onClick={onDeleteAudio}>
            Delete saved audio, keep measurements
          </button>
        )}
      </section>
      {a.warnings.length > 0 && (
        <div className="notice warning" role="status">
          <AlertCircle size={19} />
          <div>
            {a.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}
      <section className="panel">
        <div className="section-heading">
          <h3>Your pitch, over time</h3>
          <span className="tag">Measured locally</span>
        </div>
        <PitchChart analysis={a} />
      </section>
      <section className="panel">
        <h3>The measurements</h3>
        <div className="metric-grid">
          {a.metrics.map((m) => (
            <div key={m.key} className="metric">
              <span>{m.label}</span>
              <strong>
                {m.value}
                <small> {m.unit}</small>
              </strong>
              {m.score !== undefined && (
                <div className="meter">
                  <i style={{ width: `${m.score}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
        <details>
          <summary>How the score is calculated</summary>
          <p className="small">{a.formula}</p>
          <p className="small muted">
            Confidence threshold 0.85; silence floor 0.008 RMS; 65–1000 Hz
            detector. Recording gain affects loudness. Confidence means periodic
            audio, not proof of a human voice. No reliable inference about
            breath technique, vocal health, vocal type, lyrics, tone quality, or
            emotional intent is made.
          </p>
        </details>
      </section>
      <div className="two-columns">
        <section className="panel">
          <div className="section-heading">
            <h3>What you can build on</h3>
            <CheckCircle2 size={20} />
          </div>
          {a.strengths.length ? (
            a.strengths.map((s) => (
              <p key={s} className="feedback-line">
                {s}
              </p>
            ))
          ) : (
            <p className="muted">
              A clearer pitched sample will help us find specific strengths.
            </p>
          )}
        </section>
        <section className="panel">
          <h3>Your next small step</h3>
          {a.improvements.slice(0, 2).map((s) => (
            <p className="feedback-line" key={s}>
              {s}
            </p>
          ))}
          <button
            className="text-button"
            onClick={() => onPractice(a.recommendation)}
          >
            Try {exerciseInfo[a.recommendation].label.toLowerCase()}{" "}
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
      {a.observations.length > 0 && (
        <section className="panel">
          <h3>Moments to revisit</h3>
          {a.observations.map((o, i) => (
            <div className="observation" key={i}>
              <button
                className="timestamp"
                disabled={!url}
                aria-label={`Play from ${o.time.toFixed(1)} seconds`}
                onClick={() => {
                  if (player.current) {
                    player.current.currentTime = o.time;
                    void player.current
                      .play()
                      .catch(() =>
                        setAudioError(
                          "Press play in the audio controls to enable playback.",
                        ),
                      );
                  }
                }}
              >
                <Play size={12} />
                {o.time.toFixed(1)}s
              </button>
              <p>{o.text}</p>
            </div>
          ))}
        </section>
      )}
      {session.title === "Range exploration" && a.range && onRange && (
        <section className="panel">
          <h3>A starting point for comfortable practice</h3>
          <p>
            The middle 90% of detected pitches was {noteName(a.range[0])}–
            {noteName(a.range[1])}. Only use this window if these notes felt
            easy. This is provisional and may reflect detection errors.
          </p>
          <button
            className="button secondary"
            disabled={Math.floor(a.range[1]) - Math.ceil(a.range[0]) < 1}
            onClick={() =>
              onRange(Math.ceil(a.range![0]), Math.floor(a.range![1]))
            }
          >
            Use as my provisional practice range
          </button>
        </section>
      )}
      {onDelete && (
        <button className="text-button danger" onClick={onDelete}>
          <Trash2 size={15} /> Delete this session
        </button>
      )}
    </div>
  );
}
