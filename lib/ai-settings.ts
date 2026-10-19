/** Browser-only, per-user settings. Never include these in profiles or chat history. */
export const builtinProviders = [
  { id: "gemini", label: "Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "grok", label: "Grok (xAI)" },
];
export interface AIConnection {
  provider: string;
  key: string;
  model: string;
  remembered: boolean;
}
export const AI_STORAGE_KEY = "musecoach-ai-connection";
const changeEvent = "musecoach-ai-settings-change";
let connection: AIConnection | null | undefined;

export function readAIConnection(): AIConnection | null {
  // Re-read remembered settings so a key forgotten in another tab stays forgotten.
  if (connection !== undefined && !connection?.remembered) return connection;
  connection = null;
  try {
    const value = JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || "null");
    if (
      value &&
      typeof value.provider === "string" &&
      typeof value.key === "string" &&
      value.key.trim() &&
      typeof value.model === "string" &&
      value.remembered === true
    )
      connection = value;
  } catch {}
  return connection ?? null;
}
export function saveAIConnection(value: AIConnection) {
  // Remove the previous persisted key even when switching back to memory-only.
  localStorage.removeItem(AI_STORAGE_KEY);
  if (value.remembered)
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(value));
  connection = { ...value };
  window.dispatchEvent(new Event(changeEvent));
}
export function forgetAIConnection() {
  connection = null;
  try {
    localStorage.removeItem(AI_STORAGE_KEY);
  } finally {
    window.dispatchEvent(new Event(changeEvent));
  }
}
export function subscribeAIConnection(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === AI_STORAGE_KEY || event.key === null) {
      connection = undefined;
      listener();
    }
  };
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", storage);
  };
}
