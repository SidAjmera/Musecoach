"use client";
import { useEffect, useRef, useState } from "react";
import {
  builtinProviders,
  forgetAIConnection,
  readAIConnection,
  subscribeAIConnection,
  type AIConnection,
} from "@/lib/ai-settings";
import { DESIGN_STORAGE_KEY, validateDesign } from "@/lib/designed-exercise";
import { practicePlan } from "@/lib/practice-plan";
import { noteName } from "@/lib/exercises";
import { Exercise, Profile, Session } from "@/lib/types";
import AIConnectionSettings from "./AIConnectionSettings";

export default function ExerciseDesigner({
  profile,
  sessions,
  onUse,
}: {
  profile: Profile;
  sessions: Session[];
  onUse: () => void;
}) {
  const [connection, setConnection] = useState<AIConnection | null>(null);
  const [providers, setProviders] = useState(builtinProviders);
  const [prompt, setPrompt] = useState(false),
    [settings, setSettings] = useState(false),
    [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [design, setDesign] = useState<Exercise | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const sync = () => {
      controller.current?.abort();
      setBusy(false);
      setConnection(readAIConnection());
    };
    sync();
    const unsubscribe = subscribeAIConnection(sync);
    const loading = new AbortController();
    fetch("/api/coach", { signal: loading.signal })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.providers)) setProviders(data.providers);
      })
      .catch(() => {});
    return () => {
      unsubscribe();
      loading.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setDesign(null);
  }, [profile.low, profile.high, profile.coach]);

  async function generate() {
    if (!connection) {
      setPrompt(true);
      setDeclined(false);
      return;
    }
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setBusy(true);
    setError("");
    setPrompt(false);
    setDeclined(false);
    setDesign(null);
    try {
      const response = await fetch("/api/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          ai: {
            provider: connection.provider,
            key: connection.key,
            model: connection.model,
          },
          profile: {
            coach: profile.coach,
            experience: profile.experience,
            goals: profile.goals,
            low: profile.low,
            high: profile.high,
          },
          sessions: sessions
            .slice(0, 5)
            .map((session) => ({
              date: session.date,
              context: session.context,
              analysisVersion: session.analysis.version,
              metrics: session.analysis.metrics,
              score: session.analysis.score,
              improvements: session.analysis.improvements.slice(0, 3),
              completedExercise: session.analysis.exercise,
            })),
          focus: practicePlan(sessions, profile).reason,
        }),
      });
      const data = await response.json();
      if (request.signal.aborted) return;
      if (!response.ok)
        throw new Error(
          data.error ||
            "Exercise design is unavailable. Try your suggested library exercises.",
        );
      setDesign(
        validateDesign(
          {
            name: data.exercise?.name,
            rationale: data.exercise?.rationale,
            targets: data.exercise?.targets,
          },
          profile,
        ),
      );
    } catch (e) {
      if (!request.signal.aborted) setError((e as Error).message);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="panel exercise-designer"
      aria-label="AI exercise design"
    >
      <span className="eyebrow">DESIGNED WITH YOUR COACH</span>
      <h3>An exercise for your next step.</h3>
      <p className="small muted">
        {profile.coach} can use your measured skills, goals and latest pointers
        to design a comfortable 18-second exercise. Your chosen provider
        receives this text context when you press Design. Audio is never sent.
        Your provider's usage limits and prices apply.
      </p>
      <div className="tool-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? "Designing your exercise…" : "Design my exercise"}
        </button>
        {connection && (
          <button
            className="text-button"
            onClick={() => setSettings(!settings)}
          >
            Manage exercise AI connection
          </button>
        )}
      </div>
      {prompt && (
        <div
          className="notice key-prompt"
          role="group"
          aria-label="API key needed"
        >
          <strong>Add your API key to use AI exercise design.</strong>
          <p className="small">
            You can use Gemini, OpenAI, Anthropic or Grok through your own
            account, or continue with your measured practice suggestions.
          </p>
          <div className="tool-actions">
            <button
              className="button secondary"
              onClick={() => {
                setSettings(true);
                setPrompt(false);
              }}
            >
              Add API key
            </button>
            <button
              className="text-button"
              onClick={() => {
                setPrompt(false);
                setSettings(false);
                setDeclined(true);
              }}
            >
              Continue without AI
            </button>
          </div>
        </div>
      )}
      {settings && (
        <AIConnectionSettings
          connection={connection}
          providers={providers}
          busy={busy}
          onForget={forgetAIConnection}
        />
      )}
      {declined && (
        <p className="notice small" role="status">
          AI exercise design is currently unavailable without an API key. Use
          Your practice focus above: it suggests existing exercise categories
          from your measured skills and latest pointers. With insufficient
          evidence, start with its baseline exercises.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error} Your practice focus and library exercises are still available.
        </p>
      )}
      {design && (
        <div className="designed-preview">
          <span className="tag">AI-designed · measured locally</span>
          <h4>{design.name}</h4>
          <p className="small">{design.rationale}</p>
          <p className="small muted">
            Suggested by AI; checked for note range, duration and separated
            targets. This is guidance, not a measured result.
          </p>
          <ol className="designed-targets">
            {design.targets.map((target, index) => (
              <li key={index}>
                {noteName(target.midi)}{" "}
                <span>
                  {target.start.toFixed(1)}–
                  {(target.start + target.duration).toFixed(1)}s
                </span>
              </li>
            ))}
          </ol>
          <button
            className="button secondary"
            onClick={() => {
              try {
                localStorage.setItem(
                  DESIGN_STORAGE_KEY,
                  JSON.stringify(design),
                );
                onUse();
              } catch {
                setError(
                  "Could not save this exercise in your browser. Check storage permissions or use a library exercise.",
                );
              }
            }}
          >
            Use this exercise
          </button>
        </div>
      )}
    </section>
  );
}
