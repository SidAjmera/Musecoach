"use client";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { type AIConnection, saveAIConnection } from "@/lib/ai-settings";

export default function AIConnectionSettings({
  connection,
  providers,
  busy,
  onForget,
}: {
  connection: AIConnection | null;
  providers: { id: string; label: string }[];
  busy: boolean;
  onForget: () => void;
}) {
  const [provider, setProvider] = useState(connection?.provider || "gemini");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(connection?.model || "");
  const [remembered, setRemembered] = useState(connection?.remembered || false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setProvider(connection?.provider || "gemini");
    setKey("");
    setModel(connection?.model || "");
    setRemembered(connection?.remembered || false);
  }, [connection]);
  return (
    <details className="ai-connection" open={!connection}>
      <summary>
        <KeyRound size={15} />{" "}
        {connection ? "Manage your AI connection" : "Bring your own API key"}
      </summary>
      <p className="small muted">
        Use your own provider account for optional AI conversations. Your
        provider’s prices and limits apply. Recording, measured reviews, and
        exercises work without a key.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setStatus("");
          const selectedKey =
            key.trim() ||
            (connection?.provider === provider ? connection.key : "");
          if (!selectedKey || /\s/.test(selectedKey)) {
            setError("Enter the API key for your selected provider.");
            return;
          }
          try {
            saveAIConnection({
              provider,
              key: selectedKey,
              model: model.trim(),
              remembered,
            });
            setKey("");
            setStatus(
              "Connection saved. Your key and model will be checked when you send a message.",
            );
          } catch {
            setError(
              "Could not update browser storage. Allow site storage and retry. Your new settings were not saved.",
            );
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Your AI connection</legend>
          <div className="form-two">
            <label>
              AI provider
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setKey("");
                  setModel("");
                  setStatus("");
                }}
              >
                {providers.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model ID{" "}
              <span className="muted">
                {provider === "openai-compatible" ? "Required" : "Optional"}
              </span>
              <input
                value={model}
                maxLength={200}
                placeholder="Provider default"
                required={provider === "openai-compatible"}
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
          </div>
          <label>
            API key
            <input
              type="password"
              value={key}
              required={!connection || connection.provider !== provider}
              maxLength={4096}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={
                connection?.provider === provider
                  ? "Leave blank to keep your saved key"
                  : "Paste your provider’s API key"
              }
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <label className="ai-remember">
            <input
              type="checkbox"
              checked={remembered}
              onChange={(e) => setRemembered(e.target.checked)}
            />
            Remember my key on this device
          </label>
          <p className="small muted">
            By default, the key stays in this tab’s memory until you reload or
            close it. Remembering saves it unencrypted in this browser’s
            storage, accessible to scripts on this site and anyone using this
            browser profile. Use only on a device you trust.
          </p>
          <p className="small muted">
            When you send a message, your key passes through this site’s server
            to your selected provider. The app does not save it on the server.
            Only chat text and measured summaries are sent; audio stays on your
            device.
          </p>
          <button className="button secondary" type="submit">
            Save AI connection
          </button>
        </fieldset>
      </form>
      {connection && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setKey("");
            setStatus("");
            setError("");
            onForget();
          }}
        >
          Forget API key
        </button>
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
  );
}
