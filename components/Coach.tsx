"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Volume2, Settings2, LoaderCircle } from "lucide-react";
import { Profile, Session } from "@/lib/types";
import { coachById, measuredIntro } from "@/lib/coaches";
import { TonePlayer } from "@/lib/audio";
import Avatar from "./Avatar";
import { selectSpeechVoice } from "@/lib/speech";
import AIConnectionSettings from "./AIConnectionSettings";
import {
  builtinProviders,
  readAIConnection,
  forgetAIConnection,
  subscribeAIConnection,
  type AIConnection,
} from "@/lib/ai-settings";
export default function Coach({
  profile,
  sessions,
  onCustomize,
}: {
  profile: Profile;
  sessions: Session[];
  onCustomize: () => void;
}) {
  const c = coachById(profile.coach),
    latest = sessions[0],
    [connection, setConnection] = useState<AIConnection | null>(null),
    [providers, setProviders] = useState(builtinProviders),
    [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<{ role: string; content: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [speechStatus, setSpeechStatus] = useState(""),
    [configurationError, setConfigurationError] = useState("");
  const available =
      !!connection && providers.some((p) => p.id === connection.provider),
    provider =
      providers.find((p) => p.id === connection?.provider)?.label ||
      "your selected provider";
  const tones = useRef<TonePlayer | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const sync = () => {
      controller.current?.abort();
      setBusy(false);
      setConnection(readAIConnection());
    };
    sync();
    const unsubscribe = subscribeAIConnection(sync);
    fetch("/api/coach", { signal: abort.signal })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.providers)) setProviders(d.providers);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setConfigurationError(
            "Could not load provider options. The built-in providers are still available.",
          );
      });
    try {
      const saved = JSON.parse(localStorage.getItem("musecoach-chat") || "[]");
      if (Array.isArray(saved))
        setMessages(
          saved
            .filter(
              (m) =>
                ["user", "assistant"].includes(m.role) &&
                typeof m.content === "string",
            )
            .slice(-12),
        );
    } catch {}
    return () => {
      abort.abort();
      unsubscribe();
      controller.current?.abort();
      window.speechSynthesis?.cancel();
      tones.current?.stop();
    };
  }, []);
  function read(text: string) {
    if (!window.speechSynthesis) {
      setSpeechStatus("Read aloud is unavailable on this device.");
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      setSpeechStatus(
        "No speech voices are available. You can still read all feedback here.",
      );
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = selectSpeechVoice(profile, voices);
    u.onerror = () =>
      setSpeechStatus(
        "Read aloud could not play. Check your device audio settings.",
      );
    setSpeechStatus("Reading aloud.");
    u.onend = () => setSpeechStatus("");
    window.speechSynthesis.speak(u);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy || !available || !connection) return;
    setBusy(true);
    setError("");
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const trimmed = question.trim(),
        response = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: requestController.signal,
          body: JSON.stringify({
            ai: {
              provider: connection.provider,
              key: connection.key,
              model: connection.model,
            },
            message: trimmed,
            profile: {
              name: profile.name,
              coach: profile.coach,
              goals: profile.goals,
              experience: profile.experience,
              genres: profile.genres,
              pronouns: profile.pronouns,
              comfortableRange: [profile.low, profile.high],
            },
            sessions: sessions.slice(0, 5).map((s) => ({
              date: s.date,
              title: s.title,
              context: s.context,
              analysisVersion: s.analysis.version,
              metrics: s.analysis.metrics,
              score: s.analysis.score,
              formula: s.analysis.formula,
              observations: s.analysis.observations.slice(0, 3),
              completedExercise: s.analysis.exercise,
            })),
            messages: messages.slice(-12),
          }),
        });
      const data = await response.json();
      if (requestController.signal.aborted) return;
      if (!response.ok)
        throw new Error(data.error || "The coach could not respond.");
      const updated = [
        ...messages,
        { role: "user", content: trimmed },
        { role: "assistant", content: data.reply },
      ].slice(-12);
      setMessages(updated);
      setQuestion("");
      try {
        localStorage.setItem("musecoach-chat", JSON.stringify(updated));
      } catch {
        setError(
          "This reply is visible, but chat history could not be stored.",
        );
      }
    } catch (e) {
      if (requestController.signal.aborted) return;
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (controller.current === requestController) setBusy(false);
    }
  }
  return (
    <div className="coach-layout">
      <aside className="panel coach-portrait">
        <Avatar
          coach={profile.coach}
          appearance={profile.appearance}
          decorated
        />
        <span className="eyebrow">YOUR PERSONAL COACH</span>
        <h2>Meet {c.id}.</h2>
        <p>{c.traits}</p>
        <p className="muted">{c.approach}</p>
        <p className="small muted">
          {profile.version} version · {profile.pronouns}
        </p>
        <button className="button secondary" onClick={onCustomize}>
          <Settings2 size={15} /> Customise coach
        </button>
        <button
          className="text-button"
          onClick={() => {
            tones.current ||= new TonePlayer();
            const midi =
              profile.register === "low"
                ? 48
                : profile.register === "high"
                  ? 72
                  : 60;
            void tones.current
              .play([{ midi, start: 0, duration: 2 }])
              .catch(() => setError("Reference playback could not start."));
          }}
        >
          Hear a synthesised register reference
        </button>
        <p className="small muted">
          An instrumental tone, not a human voice. Your exercises use your own
          range.
        </p>
      </aside>
      <div className="coach-conversation">
        <section className="panel">
          <span className="eyebrow">
            {latest ? "YOUR LATEST MEASURED REVIEW" : "A NOTE FROM YOUR STUDIO"}
          </span>
          <h2>{c.greeting}</h2>
          {latest ? (
            <>
              <p>{measuredIntro(profile, latest.analysis.score)}</p>
              <p>
                {latest.analysis.strengths[0] || latest.analysis.warnings[0]}
              </p>
              <p>{latest.analysis.improvements[0]}</p>
              <p className="small muted">
                From “{latest.title}” · measured feedback, not an AI
                conversation.
              </p>
            </>
          ) : (
            <p className="muted">
              Make your first recording to give your coach something real to
              work with. Your results, goals, and practice will provide the
              context.
            </p>
          )}
          <button
            className="text-button"
            onClick={() =>
              read(
                `${c.greeting} ${latest?.analysis.improvements[0] || "Make your first recording to begin."}`,
              )
            }
          >
            <Volume2 size={16} /> Read aloud
          </button>
          <button
            className="text-button"
            onClick={() => {
              window.speechSynthesis?.cancel();
              setSpeechStatus("");
            }}
          >
            Stop reading
          </button>
          {speechStatus && (
            <p className="small" role="status">
              {speechStatus}
            </p>
          )}
        </section>
        <section className="panel chat-panel">
          <div className="section-heading">
            <h3>Talk it through</h3>
            <span className={`tag ${available ? "green" : ""}`}>
              {available ? "AI coach configured" : "AI coach unavailable"}
            </span>
          </div>
          {connection && (
            <p className="small muted">
              {provider} · {connection.model || "Provider default model"} ·{" "}
              {connection.remembered
                ? "Remembered on this device"
                : "This tab only"}
              . Credentials are checked when you send a message.
            </p>
          )}
          <AIConnectionSettings
            connection={connection}
            providers={providers}
            busy={busy}
            onForget={() => {
              controller.current?.abort();
              setBusy(false);
              setError("");
              try {
                forgetAIConnection();
              } catch {
                setError(
                  "The key was disconnected from memory. Browser storage could not be cleared; clear this site’s data in browser settings.",
                );
              }
            }}
          />
          {configurationError && (
            <p className="small muted" role="status">
              {configurationError}
            </p>
          )}
          {!available && (
            <div className="notice">
              Add your own API key above to enable AI conversations. Your
              measured reviews and exercises still work. No simulated chat is
              shown.
            </div>
          )}
          {messages.length > 0 && (
            <>
              <div className="messages" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.role}`}>
                    <span className="eyebrow">
                      {m.role === "user" ? "YOU" : "AI COACH RESPONSE"}
                    </span>
                    <p>{m.content}</p>
                    {m.role === "assistant" && (
                      <button
                        className="text-button"
                        onClick={() => read(m.content)}
                      >
                        <Volume2 size={14} /> Read aloud
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem("musecoach-chat");
                }}
              >
                Clear conversation
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form onSubmit={send}>
            <label htmlFor="question">Ask about your results or practice</label>
            <div className="chat-input">
              <input
                id="question"
                value={question}
                maxLength={2000}
                disabled={!available || busy}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  available
                    ? "What should I focus on next?"
                    : "Connect an AI provider to start a conversation"
                }
              />
              <button
                className="button primary"
                aria-label="Send message"
                disabled={!available || busy || !question.trim()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
            <p className="small muted">
              Sending shares your question, explicit profile settings, and
              recent measured summaries with {provider}. Audio is never sent. AI
              responses can be mistaken.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
