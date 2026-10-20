"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Session } from "@/lib/types";

export default function SessionNotes({
  session,
  onSave,
}: {
  session: Session;
  onSave: (title: string, notes: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(session.title),
    [notes, setNotes] = useState(session.notes || "");
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const generation = useRef(0);
  const fieldId = useId();
  useEffect(() => {
    setBusy(false);
    setStatus("");
    setError("");
    return () => {
      generation.current++;
    };
  }, [session.id]);
  useEffect(() => {
    setTitle(session.title);
    setNotes(session.notes || "");
  }, [session.id, session.title, session.notes]);
  const dirty =
    title.trim() !== session.title || notes.trim() !== (session.notes || "");
  return (
    <section
      className="panel session-notes"
      aria-label="Session name and private notes"
    >
      <details>
        <summary>Rename this take or add practice notes</summary>
        <p className="small muted">
          Keep a reminder of what felt useful and what you want to try next.
          Notes stay in your browser and are included in history backups. They
          are excluded from AI requests and progress CSV exports.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const token = generation.current;
            setBusy(true);
            setError("");
            setStatus("");
            try {
              await onSave(title, notes);
              if (token === generation.current)
                setStatus(
                  "Session name and notes saved. Your audio and measurements were kept.",
                );
            } catch (e) {
              if (token === generation.current) setError((e as Error).message);
            } finally {
              if (token === generation.current) setBusy(false);
            }
          }}
        >
          <label htmlFor={`title-${fieldId}`}>Session title</label>
          <input
            id={`title-${fieldId}`}
            value={title}
            maxLength={80}
            required
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label htmlFor={`notes-${fieldId}`}>Private practice notes</label>
          <textarea
            id={`notes-${fieldId}`}
            value={notes}
            maxLength={1000}
            rows={4}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What felt different? What would you like to repeat?"
          />
          <p className="small muted">{notes.length}/1,000 characters</p>
          <button
            className="button secondary"
            type="submit"
            disabled={busy || !dirty}
          >
            {busy ? "Saving notes…" : "Save session notes"}
          </button>
        </form>
        {status && (
          <p className="small" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </details>
    </section>
  );
}
