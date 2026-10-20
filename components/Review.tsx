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
import {
  noteName,
  exerciseInfo,
  provisionalPracticeWindow,
} from "@/lib/exercises";
import { getAudio } from "@/lib/storage";
import { previousAttempt } from "@/lib/comparison";
import { measuredIntro } from "@/lib/coaches";
import { decodeAudio, runAnalysis } from "@/lib/audio";
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
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {pitched
          .filter((_, i) => i % 3 === 0)
          .map((f, i) => (
            <circle
              key={i}
              cx={x(f.time)}
              cy={y(midi(f.hz!))}
              r="1.5"
              fill="var(--accent)"
            />
          ))}
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
        Blue: detected pitch · Gaps: low confidence
        {analysis.exercise ? " · Dashed gold: defined targets" : ""}. Solo
        singing works best; pitch estimates may include octave errors.
      </p>
      {!pitched.length && (
        <div className="chart-empty">
          <strong>No usable pitch detected in this take.</strong>
          <span>
            Try the microphone check, move closer, or upload a clear solo
            recording. Playback can be audible even when the recording is too
            quiet or noisy for pitch detection.
          </span>
        </div>
      )}
      {pitched.length > 0 && analysis.score === null && !analysis.exercise && (
        <p className="small muted">
          Pitch is shown above. A steadiness score needs at least three
          sustained windows; short notes and slides can still appear on the
          graph. Try Hold a note for a scored reference.
        </p>
      )}
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
  onReanalyze,
}: {
  session: Session;
  sessions: Session[];
  profile: Profile;
  audio?: Blob;
  onPractice: (kind: Analysis["recommendation"]) => void;
  onDelete?: () => void;
  onDeleteAudio?: () => void;
  onRange?: (low: number, high: number) => void;
  onReanalyze?: (session: Session, audio: Blob) => Promise<void>;
}) {
  const a = session.analysis,
    provisional = a.range ? provisionalPracticeWindow(a.range) : undefined,
    previous = previousAttempt(session, sessions),
    [url, setUrl] = useState(""),
    [audioError, setAudioError] = useState(""),
    [reanalyzing, setReanalyzing] = useState(false),
    [reanalysisStatus, setReanalysisStatus] = useState(""),
    [loop, setLoop] = useState(false),
    [loopStart, setLoopStart] = useState(0),
    [loopEnd, setLoopEnd] = useState(
      Math.round(session.analysis.duration * 10) / 10,
    ),
    [audioType, setAudioType] = useState(""),
    cancelReanalysis = useRef<() => void>(() => {}),
    player = useRef<HTMLAudioElement>(null);
  useEffect(() => () => cancelReanalysis.current(), []);
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
          setAudioType(b.type);
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
  const validLoop =
    loopStart >= 0 && loopEnd > loopStart + 0.2 && loopEnd <= a.duration + 0.15;
  const playSelection = () => {
    if (!player.current || !validLoop) return;
    player.current.currentTime = loopStart;
    void player.current
      .play()
      .catch(() =>
        setAudioError("Press play in the audio controls to enable playback."),
      );
  };
  async function reanalyze() {
    if (!onReanalyze) return;
    setReanalyzing(true);
    setAudioError("");
    setReanalysisStatus("");
    player.current?.pause();
    let cancelled = false;
    cancelReanalysis.current = () => {
      cancelled = true;
    };
    try {
      const b = audio || (await getAudio(session.id));
      if (!b)
        throw new Error(
          "Saved audio is no longer available. Upload or record a new take.",
        );
      const decoded = await decodeAudio(b);
      if (cancelled) return;
      const task = runAnalysis(decoded.samples, decoded.sampleRate, a.exercise);
      cancelReanalysis.current = () => {
        cancelled = true;
        task.cancel();
      };
      const analysis = await task.promise;
      if (cancelled) return;
      await onReanalyze({ ...session, analysis }, b);
      if (!cancelled)
        setReanalysisStatus(
          "Updated this take with the latest detector. Your saved audio was kept.",
        );
    } catch (e) {
      if (!cancelled) setAudioError((e as Error).message);
    } finally {
      if (!cancelled) setReanalyzing(false);
      cancelReanalysis.current = () => {};
    }
  }
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
        {a.exercise?.source === "ai" &&
          "AI-designed targets · scored by the local detector. "}
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
            onTimeUpdate={() => {
              const p = player.current;
              if (
                loop &&
                validLoop &&
                p &&
                !p.paused &&
                p.currentTime >= loopEnd
              ) {
                p.currentTime = loopStart;
              }
            }}
            onEnded={() => {
              if (loop && validLoop) playSelection();
            }}
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
        {url && (
          <div className="audio-tools">
            <div className="form-two">
              <label>
                Phrase start (seconds)
                <input
                  type="number"
                  min="0"
                  max={a.duration}
                  step="0.1"
                  value={loopStart}
                  onChange={(e) => setLoopStart(Number(e.target.value))}
                />
              </label>
              <label>
                Phrase end (seconds)
                <input
                  type="number"
                  min="0"
                  max={a.duration + 0.1}
                  step="0.1"
                  value={loopEnd}
                  onChange={(e) => setLoopEnd(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={loop}
                disabled={!validLoop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              Loop selected phrase
            </label>
            {!validLoop && (
              <p className="small error">
                Choose a phrase of at least 0.2 seconds within this take.
              </p>
            )}
            <div className="tool-actions">
              <button
                className="button secondary"
                disabled={!validLoop}
                onClick={playSelection}
              >
                Play selected phrase
              </button>
              <a
                className="text-button"
                href={url}
                download={`${session.title.replace(/[^a-z0-9_-]/gi, "-").slice(0, 70) || "musecoach-take"}.${audioType.includes("wav") ? "wav" : audioType.includes("mpeg") ? "mp3" : audioType.includes("mp4") ? "m4a" : audioType.includes("ogg") ? "ogg" : "webm"}`}
              >
                Download audio
              </a>
              {onReanalyze && (
                <button
                  className="text-button"
                  disabled={reanalyzing}
                  onClick={() => void reanalyze()}
                >
                  {reanalyzing ? "Reanalysing…" : "Reanalyse saved audio"}
                </button>
              )}
            </div>
            {reanalysisStatus && (
              <p className="small" role="status">
                {reanalysisStatus}
              </p>
            )}
          </div>
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
            {a.version === "yin-1.0"
              ? "This take uses the older detector. Reanalyse saved audio to use improved quiet-input detection."
              : "Confidence threshold 0.80; quiet-input floor 0.0001 RMS; 55–1400 Hz detector."}{" "}
            Recording gain affects loudness. Confidence means periodic audio,
            not proof of a human voice. No reliable inference about breath
            technique, vocal health, vocal type, lyrics, tone quality, or
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
            disabled={!provisional}
            onClick={() => {
              if (provisional) onRange(...provisional);
            }}
          >
            Use as my provisional practice range
          </button>
          {!provisional && (
            <p className="small muted">
              A provisional window needs at least two distinct notes inside the
              supported practice window, C2–E6. You can set comfortable notes in
              your profile.
            </p>
          )}
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
