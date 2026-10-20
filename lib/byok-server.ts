import { builtinProviders } from "./ai-settings";
import { resolveAIConfig } from "./ai-providers";
import { answerCoach } from "./coach-server";

type Environment = Record<string, string | undefined>;
export function byokOptions(env: Environment = process.env) {
  const providers = [...builtinProviders];
  // Only the operator can pin an additional endpoint; browsers cannot supply URLs.
  if (["openai-compatible", "custom"].includes(env.AI_PROVIDER || "")) {
    const { config } = resolveAIConfig({
      AI_PROVIDER: env.AI_PROVIDER,
      AI_BASE_URL: env.AI_BASE_URL,
      AI_MODEL: "model-required",
      AI_API_KEY: "validation-only",
    });
    if (config)
      providers.push({
        id: config.provider,
        label:
          config.provider === "custom"
            ? "Custom adapter"
            : "Compatible provider",
      });
  }
  return { mode: "byok", available: false, providers };
}

export async function answerBYOK(
  body: unknown,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
) {
  const fail = (error: string) => ({ status: 400, body: { error } });
  if (!body || typeof body !== "object" || Array.isArray(body))
    return fail("Please send a valid question.");
  const { ai, ...context } = body as Record<string, unknown>;
  const resolution = visitorEnvironment(ai, env);
  if (resolution.error) return fail(resolution.error);
  const result = await answerCoach(context, resolution.env!, fetcher);
  if (result.body.error)
    result.body.error = result.body.error.replace(
      "Check AI_PROVIDER, AI_API_KEY, and AI_MODEL in .env.local.",
      "Check the provider, API key, and model in AI connection settings.",
    );
  return result;
}

export function visitorEnvironment(
  ai: unknown,
  env: Environment = process.env,
): { env?: Environment; error?: string } {
  const fail = (error: string) => ({ error });
  if (!ai || typeof ai !== "object" || Array.isArray(ai))
    return fail("Add your own API key in AI connection settings to chat.");
  const settings = ai as Record<string, unknown>;
  if (
    Object.keys(settings).some(
      (key) => !["provider", "key", "model"].includes(key),
    )
  )
    return fail(
      "Use the provider, API key, and model fields in AI connection settings.",
    );
  if (
    typeof settings.provider !== "string" ||
    !byokOptions(env).providers.some((p) => p.id === settings.provider)
  )
    return fail("Choose an available AI provider in connection settings.");
  if (
    typeof settings.key !== "string" ||
    !settings.key.trim() ||
    settings.key.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(settings.key.trim())
  )
    return fail("Enter a valid API key in AI connection settings.");
  if (
    settings.model !== undefined &&
    (typeof settings.model !== "string" ||
      settings.model.length > 200 ||
      /[\x00-\x1f\x7f]/.test(settings.model))
  )
    return fail("Enter a valid model ID in AI connection settings.");
  // Construct a fresh environment. Never inherit the operator's API key or provider.
  const config = {
    AI_PROVIDER: settings.provider,
    AI_API_KEY: settings.key.trim(),
    AI_MODEL: typeof settings.model === "string" ? settings.model.trim() : "",
    AI_BASE_URL: ["custom", "openai-compatible"].includes(settings.provider)
      ? env.AI_BASE_URL
      : undefined,
  };
  if (!resolveAIConfig(config).config)
    return fail(
      "Check your provider and model in AI connection settings. A model ID is required for a compatible provider.",
    );
  return { env: config };
}
