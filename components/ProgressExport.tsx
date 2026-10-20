"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { progressCSV } from "@/lib/progress-export";
import { Session } from "@/lib/types";

export default function ProgressExport({ sessions }: { sessions: Session[] }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  function download() {
    setError("");
    setStatus("");
    let url = "";
    try {
      url = URL.createObjectURL(
        new Blob([progressCSV(sessions)], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `musecoach-progress-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus(
        `Prepared summaries for ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}. Missing measurements are blank.`,
      );
    } catch {
      setError(
        "Could not prepare your download. Try again in a browser that supports file downloads.",
      );
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  return (
    <section
      className="panel progress-export"
      aria-label="Export your progress"
    >
      <span className="eyebrow">KEEP A COPY OF YOUR PRACTICE</span>
      <h3>Your progress, to take with you.</h3>
      <p className="small muted">
        Download a spreadsheet-friendly summary of your reviewed takes, measured
        scores and supported metrics. The file includes session titles and
        dates. Audio, coach conversations and API keys are excluded. Everything
        is prepared in this browser.
      </p>
      <button
        className="button secondary"
        disabled={sessions.length === 0}
        onClick={download}
      >
        <Download size={16} /> Download progress CSV
      </button>
      {sessions.length === 0 && (
        <p className="small muted">
          Review a take first to create your first export.
        </p>
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
    </section>
  );
}
