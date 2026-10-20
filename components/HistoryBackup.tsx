"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import {
  historyBackupJSON,
  parseHistoryBackup,
  MAX_BACKUP_BYTES,
  type HistoryBackup as Backup,
} from "@/lib/history-backup";
import { Profile, Session } from "@/lib/types";

export interface RestoreResult {
  added: number;
  skipped: number;
  profileRestored: boolean;
  profileError?: string;
}
export default function HistoryBackup({
  profile,
  sessions,
  onRestore,
}: {
  profile: Profile;
  sessions: Session[];
  onRestore: (
    backup: Backup,
    replaceProfile: boolean,
  ) => Promise<RestoreResult>;
}) {
  const [candidate, setCandidate] = useState<Backup | null>(null),
    [replaceProfile, setReplaceProfile] = useState(false);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const currentIds = new Set(sessions.map((s) => s.id));
  const fresh =
    candidate?.sessions.filter((s) => !currentIds.has(s.id)).length || 0;
  function download() {
    setStatus("");
    setError("");
    let url = "";
    try {
      const json = historyBackupJSON(profile, sessions);
      url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `musecoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus(
        `Prepared a backup of your profile and ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}. Audio and API keys are excluded.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  async function choose(file?: File) {
    const token = ++generation.current;
    setCandidate(null);
    setReplaceProfile(false);
    setStatus("");
    setError("");
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Choose a Musecoach backup smaller than 64 MB.");
      const backup = parseHistoryBackup(await file.text());
      if (token === generation.current) setCandidate(backup);
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    }
  }
  async function restore() {
    if (!candidate || busy) return;
    const token = generation.current;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await onRestore(candidate, replaceProfile);
      if (token !== generation.current) return;
      setStatus(
        `Restored ${result.added} ${result.added === 1 ? "session" : "sessions"}. Kept ${result.skipped} existing ${result.skipped === 1 ? "session" : "sessions"} with matching IDs.${result.profileRestored ? " Profile restored too." : " Current profile kept."} Audio and API connections were not restored.`,
      );
      if (result.profileError) setError(result.profileError);
      else setCandidate(null);
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  return (
    <section
      className="panel history-backup"
      aria-label="Back up or restore history"
    >
      <details className="backup-details">
        <summary>Back up or restore history</summary>
        <span className="eyebrow">MOVE BETWEEN BROWSERS OR DEVICES</span>
        <h3>Keep your history with you.</h3>
        <p className="small muted">
          Save your profile, reviews, pitch graphs and exercise references in a
          backup file. Open it in Musecoach on another device to restore them.
          Audio, conversations and API keys are excluded; download any saved
          audio separately from its review. Files stay on your device.
        </p>
        <button className="button secondary" disabled={busy} onClick={download}>
          <Download size={16} /> Download history backup
        </button>
        <div className="backup-import">
          <label htmlFor="history-backup-file">
            <FolderOpen size={16} /> Choose a history backup to preview
          </label>
          <input
            id="history-backup-file"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void choose(file);
            }}
          />
          <p className="small muted">
            Up to 64 MB and 1,000 sessions. Choosing a file only previews it.
            Existing sessions and their audio are kept; matching session IDs are
            skipped.
          </p>
        </div>
        {candidate && (
          <div className="backup-preview">
            <h4>Ready to restore</h4>
            <p className="small">
              {candidate.sessions.length} sessions in this backup · {fresh} new
              · {candidate.sessions.length - fresh} already here.
            </p>
            <p className="small muted">
              Backup created{" "}
              {new Date(candidate.exportedAt).toLocaleDateString()}. Imported
              measurements are restored as saved, rather than reanalysed.
            </p>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={replaceProfile}
                onChange={(e) => setReplaceProfile(e.target.checked)}
                disabled={busy}
              />{" "}
              Use the profile from this backup
              {candidate.profile.name ? ` (${candidate.profile.name})` : ""}
            </label>
            <button
              className="button primary"
              disabled={busy || (fresh === 0 && !replaceProfile)}
              onClick={() => void restore()}
            >
              {busy ? "Restoring history…" : "Restore this backup"}
            </button>
            {fresh === 0 && !replaceProfile && (
              <p className="small muted">
                These sessions are already here. Select the profile option if
                you also want to restore its settings.
              </p>
            )}
          </div>
        )}
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
