/** Server-only provider adapters. Never import this module into a client component. */
type Environment = Record<string, string | undefined>;
type Provider =
  "openai" | "gemini" | "anthropic" | "grok" | "openai-compatible" | "custom";
export interface AIConfig {
  provider: Provider;
  label: string;
  key: string;
  model: string;
  baseURL?: string;
}
export const REPLY_SCHEMA = {
  type: "object",
  properties: { reply: { type: "string" } },
  required: ["reply"],
  additionalProperties: false,
};
const defaults: Record<Provider, { label: string; model: string }> = {
  openai: { label: "OpenAI", model: "gpt-4.1-mini" },
  gemini: { label: "Gemini", model: "gemini-3.8-flash" },
  anthropic: { label: "Anthropic", model: "claude-haiku-4-5" },
  grok: { label: "Grok (xAI)", model: "grok-4.7" },
  "openai-compatible": { label: "your configured AI provider", model: "" },
  custom: { label: "your custom AI provider", model: "" },
};
const aliases: Record<string, Provider> = {
  openai: "openai",
  gemini: "gemini",
  google: "gemini",
  anthropic: "anthropic",
  claude: "anthropic",
  grok: "grok",
  xai: "grok",
  "x.ai": "grok",
  "openai-compatible": "openai-compatible",
  custom: "custom",
};

export function resolveAIConfig(env: Environment = process.env): {
  config?: AIConfig;
  label: string;
  error?: string;
} {
  const name = env.AI_PROVIDER?.trim().toLowerCase() || "";
  const provider = Object.hasOwn(aliases, name) ? aliases[name] : undefined;
  if (!provider)
    return {
      label: "the configured AI provider",
      error:
        "Set AI_PROVIDER to gemini, openai, anthropic, grok, openai-compatible, or custom in .env.local.",
    };
  const { label, model: defaultModel } = defaults[provider],
    key = env.AI_API_KEY?.trim();
  if (!key)
    return {
      label,
      error:
        "Add your selected provider’s key as AI_API_KEY in .env.local to enable coach conversations.",
    };
  const model = env.AI_MODEL?.trim() || defaultModel;
  if (provider !== "custom" && (!model || model.length > 200))
    return {
      label,
      error:
        "Set AI_MODEL to a valid model ID for your provider in .env.local.",
    };
  let baseURL: string | undefined;
  if (provider === "openai-compatible" || provider === "custom") {
    try {
      const url = new URL(env.AI_BASE_URL?.trim() || "");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      baseURL = url.toString().replace(/\/+$/, "");
    } catch {
      return {
        label,
        error:
          "Set AI_BASE_URL to a trusted HTTPS endpoint (HTTP is allowed only for localhost). Do not include credentials or query parameters.",
      };
    }
  }
  return { label, config: { provider, label, key, model, baseURL } };
}

export function coachStatus(env: Environment = process.env) {
  const { config, label, error } = resolveAIConfig(env);
  // Deliberately expose no key, URL, environment contents, or model-provider response.
  return {
    available: !!config,
    provider: label,
    ...(!config ? { error } : {}),
  };
}

export class ProviderError extends Error {
  constructor(
    public readonly kind:
      "auth" | "quota" | "unavailable" | "invalid" | "timeout",
  ) {
    super(kind);
  }
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
function jsonReply(text: unknown): string {
  if (typeof text !== "string") throw new ProviderError("invalid");
  const parsed = object(JSON.parse(text));
  if (
    Object.keys(parsed).length !== 1 ||
    typeof parsed.reply !== "string" ||
    !parsed.reply.trim() ||
    parsed.reply.length > 1800
  )
    throw new ProviderError("invalid");
  return parsed.reply.trim();
}
function textParts(parts: unknown, type: string) {
  return array(parts)
    .map(object)
    .filter((part) => part.type === type)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

export async function requestCoach(
  config: AIConfig,
  system: string,
  context: unknown,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const { provider, key, model } = config,
    input = JSON.stringify(context);
  let url: string, body: unknown;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`;
    headers["x-goog-api-key"] = key;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: {
        maxOutputTokens: 4096,
        responseFormat: {
          text: { mimeType: "APPLICATION_JSON", schema: REPLY_SCHEMA },
        },
      },
    };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: input }],
      output_config: { format: { type: "json_schema", schema: REPLY_SCHEMA } },
    };
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.Authorization = `Bearer ${key}`;
    body = {
      model,
      store: false,
      instructions: system,
      input,
      max_output_tokens: 1024,
      text: {
        format: {
          type: "json_schema",
          name: "coach_reply",
          strict: true,
          schema: REPLY_SCHEMA,
        },
      },
    };
  } else if (provider === "grok" || provider === "openai-compatible") {
    const base = provider === "grok" ? "https://api.x.ai/v1" : config.baseURL!;
    url = base.endsWith("/chat/completions")
      ? base
      : `${base}/chat/completions`;
    headers.Authorization = `Bearer ${key}`;
    body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
      max_tokens: provider === "grok" ? 4096 : 1024,
      response_format:
        provider === "grok"
          ? {
              type: "json_schema",
              json_schema: {
                name: "coach_reply",
                strict: true,
                schema: REPLY_SCHEMA,
              },
            }
          : { type: "json_object" },
    };
  } else {
    url = config.baseURL!;
    headers.Authorization = `Bearer ${key}`;
    body = { system, ...object(context) };
  }
  const response = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok)
    throw new ProviderError(
      response.status === 401 || response.status === 403
        ? "auth"
        : response.status === 429 || response.status === 402
          ? "quota"
          : "unavailable",
    );
  const data = object(await response.json());
  if (provider === "openai") {
    if (data.status !== "completed") throw new ProviderError("invalid");
    const messages = array(data.output)
      .map(object)
      .filter((item) => item.type === "message");
    if (
      messages.some((m) =>
        array(m.content)
          .map(object)
          .some((p) => p.type === "refusal"),
      )
    )
      throw new ProviderError("invalid");
    return jsonReply(
      messages.map((m) => textParts(m.content, "output_text")).join(""),
    );
  }
  if (provider === "gemini") {
    const candidate = object(array(data.candidates)[0]);
    if (
      candidate.finishReason !== "STOP" ||
      object(data.promptFeedback).blockReason
    )
      throw new ProviderError("invalid");
    const parts = array(object(candidate.content).parts)
      .map(object)
      .filter((p) => p.thought !== true);
    return jsonReply(
      parts.map((p) => (typeof p.text === "string" ? p.text : "")).join(""),
    );
  }
  if (provider === "anthropic") {
    if (data.stop_reason !== "end_turn") throw new ProviderError("invalid");
    return jsonReply(textParts(data.content, "text"));
  }
  if (provider === "grok" || provider === "openai-compatible") {
    const choice = object(array(data.choices)[0]),
      message = object(choice.message);
    if (choice.finish_reason !== "stop" || message.refusal)
      throw new ProviderError("invalid");
    return jsonReply(message.content);
  }
  return jsonReply(JSON.stringify(data));
}
