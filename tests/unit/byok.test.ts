import { describe, it, expect, vi } from "vitest";
import { answerBYOK, byokOptions } from "../../lib/byok-server";

const context = {
  message: "What should I practise?",
  profile: { coach: "Theo" },
  sessions: [],
  messages: [],
};
const host = {
  AI_PROVIDER: "openai",
  AI_API_KEY: "operator-secret",
  AI_MODEL: "operator-model",
  AI_BASE_URL: "https://operator.example/v1",
};
const reply = JSON.stringify({ reply: "Try a comfortable held note." });
describe("per-user AI credentials", () => {
  it("never uses the operator key when a visitor has no key", async () => {
    const fetcher = vi.fn();
    const result = await answerBYOK(context, host, fetcher);
    expect(result.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(byokOptions(host))).not.toMatch(
      /operator-secret|operator-model|operator.example/,
    );
    expect(byokOptions(host).available).toBe(false);
  });
  it.each(["gemini", "openai", "anthropic", "grok"])(
    "uses only the visitor credential with %s",
    async (provider) => {
      const data =
        provider === "gemini"
          ? {
              candidates: [
                { finishReason: "STOP", content: { parts: [{ text: reply }] } },
              ],
            }
          : provider === "openai"
            ? {
                status: "completed",
                output: [
                  {
                    type: "message",
                    content: [{ type: "output_text", text: reply }],
                  },
                ],
              }
            : provider === "anthropic"
              ? {
                  stop_reason: "end_turn",
                  content: [{ type: "text", text: reply }],
                }
              : {
                  choices: [
                    { finish_reason: "stop", message: { content: reply } },
                  ],
                };
      const fetcher = vi.fn().mockResolvedValue(Response.json(data));
      expect(
        (
          await answerBYOK(
            {
              ...context,
              ai: { provider, key: "visitor-secret", model: "visitor-model" },
            },
            host,
            fetcher,
          )
        ).status,
      ).toBe(200);
      const [url, options] = fetcher.mock.calls[0];
      expect(JSON.stringify(options.headers)).toContain("visitor-secret");
      expect(options.body).not.toMatch(
        /visitor-secret|operator-secret|operator-model|"ai"/,
      );
      expect(provider === "gemini" ? url : options.body).toContain(
        "visitor-model",
      );
      expect(url).not.toContain("operator.example");
      expect(JSON.stringify(options)).not.toContain("operator-secret");
    },
  );
  it("isolates simultaneous visitors", async () => {
    const fetcher = vi.fn().mockImplementation(async () =>
      Response.json({
        choices: [{ finish_reason: "stop", message: { content: reply } }],
      }),
    );
    await Promise.all(
      ["alice-secret", "bob-secret"].map((key) =>
        answerBYOK(
          { ...context, ai: { provider: "grok", key } },
          host,
          fetcher,
        ),
      ),
    );
    expect(
      fetcher.mock.calls
        .map(([, options]) => options.headers.Authorization)
        .sort(),
    ).toEqual(["Bearer alice-secret", "Bearer bob-secret"]);
  });
  it.each([
    null,
    {},
    { provider: "gemini", key: "" },
    { provider: "gemini", key: "with spaces" },
    { provider: "gemini", key: "bad\nheader" },
    { provider: "gemini", key: "x".repeat(4097) },
    { provider: "unknown", key: "secret" },
    { provider: "constructor", key: "secret" },
    { provider: "gemini", key: "secret", model: {} },
    { provider: "gemini", key: "secret", model: "x".repeat(201) },
    { provider: "gemini", key: "secret", baseURL: "http://169.254.169.254" },
    { provider: "openai-compatible", key: "secret", model: "a-model" },
  ])(
    "rejects malformed or unauthorized credentials without calling upstream",
    async (ai) => {
      const fetcher = vi.fn();
      expect((await answerBYOK({ ...context, ai }, host, fetcher)).status).toBe(
        400,
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("only uses an additional endpoint pinned by the operator", async () => {
    const env = {
      ...host,
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://trusted.example/v1",
    };
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ finish_reason: "stop", message: { content: reply } }],
      }),
    );
    expect(
      byokOptions(env).providers.some((p) => p.id === "openai-compatible"),
    ).toBe(true);
    expect(
      (
        await answerBYOK(
          {
            ...context,
            ai: {
              provider: "openai-compatible",
              key: "visitor-secret",
              model: "a-model",
            },
          },
          env,
          fetcher,
        )
      ).status,
    ).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://trusted.example/v1/chat/completions",
    );
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer visitor-secret",
    );
  });
  it("keeps provider failures generic and useful for visitors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("secret provider error", { status: 401 }),
      );
    const result = await answerBYOK(
      { ...context, ai: { provider: "gemini", key: "visitor-secret" } },
      host,
      fetcher,
    );
    expect(result.body.error).toContain("AI connection settings");
    expect(JSON.stringify(result)).not.toMatch(
      /visitor-secret|operator-secret|\.env|secret provider error/,
    );
  });
});
