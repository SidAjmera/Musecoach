import { describe, it, expect, vi } from "vitest";
import { answerCoach, coachAvailable } from "../../lib/coach-server";
import {
  resolveAIConfig,
  coachStatus,
  REPLY_SCHEMA,
} from "../../lib/ai-providers";
const body = {
  message: "Explain my pitch",
  profile: { name: "Ari", coach: "Theo", goals: ["Pitch stability"] },
  sessions: [],
  messages: [],
};
const reply = "Try a comfortable held note.";
const json = JSON.stringify({ reply });
const providers = ["openai", "gemini", "anthropic", "grok"] as const;
const env = (provider: string, extra: Record<string, string> = {}) => ({
  AI_PROVIDER: provider,
  AI_API_KEY: "fixture-secret",
  ...extra,
});
const fixture = (provider: string, text = json): unknown =>
  provider === "openai"
    ? {
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text }] }],
      }
    : provider === "gemini"
      ? {
          candidates: [
            { finishReason: "STOP", content: { parts: [{ text }] } },
          ],
        }
      : provider === "anthropic"
        ? { stop_reason: "end_turn", content: [{ type: "text", text }] }
        : { choices: [{ finish_reason: "stop", message: { content: text } }] };
describe("provider configuration", () => {
  it.each(providers)(
    "uses one shared key with %s and supplies a default model",
    (provider) => {
      const { config } = resolveAIConfig(env(provider));
      expect(config?.provider).toBe(provider);
      expect(config?.key).toBe("fixture-secret");
      expect(config?.model).toBeTruthy();
      expect(coachAvailable(env(provider))).toBe(true);
    },
  );
  it.each([
    ["Gemini", "gemini"],
    ["OPENAI", "openai"],
    ["Claude", "anthropic"],
    ["xAI", "grok"],
    ["x.ai", "grok"],
  ])("normalizes %s", (name, result) =>
    expect(resolveAIConfig(env(name)).config?.provider).toBe(result),
  );
  it("uses a provider-specific model override", () =>
    expect(
      resolveAIConfig(env("gemini", { AI_MODEL: "models/example-model" }))
        .config?.model,
    ).toBe("models/example-model"));
  it("does not enable ambient credentials or guess a provider from the key", () => {
    expect(
      coachAvailable({
        OPENAI_API_KEY: "inherited",
        MUSECOACH_AI_ENABLED: "true",
      }),
    ).toBe(false);
    expect(coachAvailable({ AI_API_KEY: "fixture" })).toBe(false);
  });
  it.each([
    {},
    { AI_PROVIDER: "gemini" },
    { AI_PROVIDER: "grok", AI_API_KEY: "  " },
    { AI_PROVIDER: "unknown", AI_API_KEY: "fixture" },
    { AI_PROVIDER: "constructor", AI_API_KEY: "fixture" },
    { AI_PROVIDER: "__proto__", AI_API_KEY: "fixture" },
  ])("keeps invalid or missing settings unavailable", async (configuration) => {
    const fetcher = vi.fn();
    expect((await answerCoach(body, configuration, fetcher)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns a useful invalid-provider explanation without echoing configuration", () => {
    const result = coachStatus(env("fixture-secret"));
    expect(result.error).toContain("AI_PROVIDER");
    expect(JSON.stringify(result)).not.toContain("fixture-secret");
  });
  it("does not expose keys or endpoint URLs in the public status", () => {
    const result = coachStatus(
      env("openai-compatible", {
        AI_BASE_URL: "https://private.example/v1",
        AI_MODEL: "a-model",
      }),
    );
    expect(result.available).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /fixture-secret|private.example/,
    );
  });
  it.each([
    "not a URL",
    "http://remote.example/v1",
    "https://name:password@example.com/v1",
    "https://example.com/v1?key=secret",
    "https://example.com/v1#secret",
  ])("rejects unsafe custom endpoint %s", (url) =>
    expect(
      resolveAIConfig(
        env("openai-compatible", { AI_BASE_URL: url, AI_MODEL: "a-model" }),
      ).config,
    ).toBeUndefined(),
  );
  it("requires an explicit model for another compatible service", () =>
    expect(
      resolveAIConfig(
        env("openai-compatible", { AI_BASE_URL: "https://example.test/v1" }),
      ).error,
    ).toContain("AI_MODEL"));
  it("accepts a local compatible server", () =>
    expect(
      resolveAIConfig(
        env("openai-compatible", {
          AI_BASE_URL: "http://localhost:11434/v1/",
          AI_MODEL: "local-model",
        }),
      ).config?.baseURL,
    ).toBe("http://localhost:11434/v1"));
});
describe("native provider adapters", () => {
  it.each(providers)(
    "normalizes a real %s response format and sends only the selected key",
    async (provider) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(Response.json(fixture(provider)));
      const result = await answerCoach(
        body,
        env(provider, { OPENAI_API_KEY: "unrelated-secret" }),
        fetcher,
      );
      expect(result).toEqual({ status: 200, body: { reply } });
      const [url, options] = fetcher.mock.calls[0];
      const sent = JSON.parse(options.body);
      expect(options.method).toBe("POST");
      expect(options.redirect).toBe("error");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(String(url)).not.toContain("fixture-secret");
      expect(options.body).not.toMatch(/fixture-secret|unrelated-secret/);
      expect(options.body).toContain("Do not invent");
      expect(options.body).not.toContain("audio_base64");
      if (provider === "gemini") {
        expect(url).toContain(
          "generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        );
        expect(options.headers["x-goog-api-key"]).toBe("fixture-secret");
        expect(sent.generationConfig.responseFormat.text).toEqual({
          mimeType: "APPLICATION_JSON",
          schema: REPLY_SCHEMA,
        });
        expect(options.headers.Authorization).toBeUndefined();
      }
      if (provider === "anthropic") {
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(options.headers["x-api-key"]).toBe("fixture-secret");
        expect(options.headers["anthropic-version"]).toBe("2023-06-01");
        expect(sent.output_config.format.schema).toEqual(REPLY_SCHEMA);
      }
      if (provider === "openai") {
        expect(url).toBe("https://api.openai.com/v1/responses");
        expect(sent.store).toBe(false);
        expect(sent.text.format.strict).toBe(true);
        expect(options.headers.Authorization).toBe("Bearer fixture-secret");
      }
      if (provider === "grok") {
        expect(url).toBe("https://api.x.ai/v1/chat/completions");
        expect(sent.response_format.json_schema.strict).toBe(true);
        expect(options.headers.Authorization).toBe("Bearer fixture-secret");
      }
    },
  );
  it.each(providers)(
    "handles %s authentication errors without leaking response details",
    async (provider) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "fixture-secret" }, { status: 401 }),
        );
      const result = await answerCoach(body, env(provider), fetcher);
      expect(result.status).toBe(502);
      expect(result.body.error).toContain("API key");
      expect(result.body.error).not.toContain("fixture-secret");
    },
  );
  it.each(providers)("handles %s quota exhaustion", async (provider) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({}, { status: 429 }));
    const result = await answerCoach(body, env(provider), fetcher);
    expect(result.status).toBe(429);
    expect(result.body.error).toContain("quota");
  });
  it.each(providers)("handles %s provider failures", async (provider) => {
    const fetcher = vi.fn().mockRejectedValue(new Error("fixture-secret"));
    const result = await answerCoach(body, env(provider), fetcher);
    expect(result.status).toBe(502);
    expect(result.body.error).not.toContain("fixture-secret");
  });
  it.each(providers)("rejects malformed %s output", async (provider) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json(fixture(provider, "not JSON")));
    expect((await answerCoach(body, env(provider), fetcher)).status).toBe(502);
  });
  it.each(providers)(
    "rejects empty, oversized, or wrongly shaped %s replies",
    async (provider) => {
      for (const invalid of [
        { reply: "" },
        { reply: "x".repeat(1801) },
        { score: 95 },
        { reply: "valid", extra: true },
      ]) {
        const fetcher = vi
          .fn()
          .mockResolvedValue(
            Response.json(fixture(provider, JSON.stringify(invalid))),
          );
        expect((await answerCoach(body, env(provider), fetcher)).status).toBe(
          502,
        );
      }
    },
  );
  it.each(providers)(
    "rejects incomplete or refused %s output",
    async (provider) => {
      const incomplete =
        provider === "openai"
          ? { status: "incomplete", output: [] }
          : provider === "gemini"
            ? {
                candidates: [
                  {
                    finishReason: "MAX_TOKENS",
                    content: { parts: [{ text: json }] },
                  },
                ],
              }
            : provider === "anthropic"
              ? {
                  stop_reason: "max_tokens",
                  content: [{ type: "text", text: json }],
                }
              : {
                  choices: [
                    { finish_reason: "length", message: { content: json } },
                  ],
                };
      expect(
        (
          await answerCoach(
            body,
            env(provider),
            vi.fn().mockResolvedValue(Response.json(incomplete)),
          )
        ).status,
      ).toBe(502);
    },
  );
  it("rejects a Gemini safety block", async () => {
    const blocked = {
      promptFeedback: { blockReason: "SAFETY" },
      candidates: [],
    };
    expect(
      (
        await answerCoach(
          body,
          env("gemini"),
          vi.fn().mockResolvedValue(Response.json(blocked)),
        )
      ).status,
    ).toBe(502);
  });
  it("does not treat Gemini thought parts as the final answer", async () => {
    const data = {
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "internal reasoning" },
              { text: json },
            ],
          },
        },
      ],
    };
    expect(
      (
        await answerCoach(
          body,
          env("gemini"),
          vi.fn().mockResolvedValue(Response.json(data)),
        )
      ).body.reply,
    ).toBe(reply);
  });
  it("encodes Gemini model overrides as one URL component", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture("gemini")));
    await answerCoach(
      body,
      env("gemini", { AI_MODEL: "models/custom-model" }),
      fetcher,
    );
    expect(fetcher.mock.calls[0][0]).toContain(
      "/models/custom-model:generateContent",
    );
  });
  it("reports timeout recovery without exposing the exception", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new DOMException("private details", "TimeoutError"));
    const result = await answerCoach(body, env("gemini"), fetcher);
    expect(result.body.error).toContain("took too long");
    expect(result.body.error).not.toContain("private details");
  });
});
describe("other provider protocols", () => {
  it("uses another OpenAI-compatible endpoint with the same key", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture("grok")));
    const result = await answerCoach(
      body,
      env("openai-compatible", {
        AI_BASE_URL: "https://example.test/v1/",
        AI_MODEL: "my-model",
      }),
      fetcher,
    );
    expect(result.body.reply).toBe(reply);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://example.test/v1/chat/completions",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body).response_format.type).toBe(
      "json_object",
    );
  });
  it("supports the existing custom adapter contract through generic settings", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ reply }));
    const result = await answerCoach(
      body,
      env("custom", { AI_BASE_URL: "https://example.test/my-adapter" }),
      fetcher,
    );
    expect(result.status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe("https://example.test/my-adapter");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).profile.coach).toBe(
      "Theo",
    );
  });
  it("rejects malformed questions before contacting any provider", async () => {
    const fetcher = vi.fn();
    for (const invalid of [
      null,
      { ...body, message: "x".repeat(2001) },
      { ...body, message: " " },
      { ...body, profile: { coach: "Unknown" } },
    ])
      expect((await answerCoach(invalid, env("gemini"), fetcher)).status).toBe(
        400,
      );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
