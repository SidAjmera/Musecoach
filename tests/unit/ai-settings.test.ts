import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
beforeEach(() => {
  vi.resetModules();
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());
describe("browser API key storage", () => {
  it("keeps keys in memory by default and removes a previously remembered key", async () => {
    const settings = await import("../../lib/ai-settings");
    const value = {
      provider: "gemini",
      key: "fixture-key",
      model: "",
      remembered: true,
    };
    settings.saveAIConnection(value);
    expect(values.size).toBe(1);
    settings.saveAIConnection({ ...value, remembered: false });
    expect(values.size).toBe(0);
    expect(settings.readAIConnection()?.key).toBe("fixture-key");
    vi.resetModules();
    const reloaded = await import("../../lib/ai-settings");
    expect(reloaded.readAIConnection()).toBeNull();
  });
  it("restores only explicitly remembered credentials and forgets them", async () => {
    let settings = await import("../../lib/ai-settings");
    settings.saveAIConnection({
      provider: "grok",
      key: "fixture-key",
      model: "a-model",
      remembered: true,
    });
    vi.resetModules();
    settings = await import("../../lib/ai-settings");
    expect(settings.readAIConnection()?.provider).toBe("grok");
    settings.forgetAIConnection();
    expect(settings.readAIConnection()).toBeNull();
    expect(values.size).toBe(0);
  });
  it("notifies mounted views of changes and never rehydrates a forgotten key if removal fails", async () => {
    const settings = await import("../../lib/ai-settings");
    settings.saveAIConnection({
      provider: "grok",
      key: "fixture-key",
      model: "",
      remembered: true,
    });
    const listener = vi.fn(() => settings.readAIConnection());
    const unsubscribe = settings.subscribeAIConnection(listener);
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => settings.forgetAIConnection()).toThrow("denied");
    expect(listener).toHaveReturnedWith(null);
    expect(settings.readAIConnection()).toBeNull();
    unsubscribe();
  });
});
