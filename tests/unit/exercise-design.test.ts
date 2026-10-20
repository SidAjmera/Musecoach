import { expect, it, vi } from "vitest";
import { validateDesign, DESIGN_SCHEMA } from "../../lib/designed-exercise";
import { designExercise } from "../../lib/exercise-design-server";
import { defaultProfile } from "../../lib/types";
import { summarize } from "../../lib/analysis";
import { midiHz } from "../../lib/exercises";

const design = {
  name: "A small step for your next take",
  rationale: "Use a small interval with clear gaps to practise note entries.",
  targets: [60, 62, 60, 64].map((midi, i) => ({
    midi,
    start: 3 + i * 3,
    duration: 2,
  })),
};
const profile = {
  coach: "Theo",
  experience: "beginner",
  goals: ["Timing"],
  low: 48,
  high: 72,
};
const body = (provider = "gemini") => ({
  ai: { provider, key: "visitor-design-fixture", model: "" },
  profile,
  sessions: [],
  focus: "Timing",
});
const fixture = (provider: string, output: unknown = design) => {
  const text = JSON.stringify(output);
  if (provider === "gemini")
    return {
      candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    };
  if (provider === "openai")
    return {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text }] }],
    };
  if (provider === "anthropic")
    return { stop_reason: "end_turn", content: [{ type: "text", text }] };
  return { choices: [{ finish_reason: "stop", message: { content: text } }] };
};
it("validates an AI reference that can genuinely be scored locally", () => {
  const exercise = validateDesign(design, defaultProfile);
  const frames = Array.from({ length: 360 }, (_, i) => {
    const time = i * 0.05;
    const target = exercise.targets.find(
      (t) => time >= t.start && time < t.start + t.duration,
    );
    return {
      time,
      hz: target ? midiHz(target.midi) : null,
      rms: target ? 0.1 : 0,
      confidence: target ? 1 : 0,
    };
  });
  expect(summarize(frames, 18, 0, exercise).score).toBeGreaterThanOrEqual(98);
  expect(exercise.source).toBe("ai");
});
it.each([
  { ...design, unexpected: true },
  { ...design, name: "" },
  { ...design, rationale: "x".repeat(501) },
  { ...design, targets: [] },
  {
    ...design,
    targets: [...design.targets, ...design.targets, ...design.targets],
  },
  { ...design, targets: design.targets.map((t) => ({ ...t, midi: 99 })) },
  { ...design, targets: design.targets.map((t) => ({ ...t, midi: 60.5 })) },
  { ...design, targets: design.targets.map((t) => ({ ...t, start: 2 })) },
  { ...design, targets: design.targets.map((t) => ({ ...t, duration: 0.5 })) },
  { ...design, targets: design.targets.map((t) => ({ ...t, duration: 6 })) },
  {
    ...design,
    targets: design.targets.map((t) => ({ ...t, start: Infinity })),
  },
  {
    ...design,
    targets: design.targets.map((t) => ({ ...t, start: t.start + 10 })),
  },
])("rejects unsafe or unusable model targets %#", (value) => {
  expect(() => validateDesign(value, defaultProfile)).toThrow(
    "range and timing",
  );
});
it.each(["gemini", "openai", "anthropic", "grok"])(
  "uses the visitor's %s key and structured design schema",
  async (provider) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture(provider)));
    const result = await designExercise(
      body(provider),
      { AI_PROVIDER: "openai", AI_API_KEY: "operator-secret" },
      fetcher,
    );
    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty("exercise.name", design.name);
    const [, request] = fetcher.mock.calls[0];
    expect(JSON.stringify(request.headers)).toContain("visitor-design-fixture");
    expect(String(request.body)).not.toMatch(
      /operator-secret|visitor-design-fixture/,
    );
    expect(String(request.body)).toContain(JSON.stringify(DESIGN_SCHEMA));
  },
);
it("never falls back to an operator key or calls a provider without a visitor key", async () => {
  const fetcher = vi.fn();
  const result = await designExercise(
    { profile, sessions: [] },
    { AI_PROVIDER: "gemini", AI_API_KEY: "operator-secret" },
    fetcher,
  );
  expect(result.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects targets outside the user's range even after a provider succeeds", async () => {
  const bad = {
    ...design,
    targets: design.targets.map((t) => ({ ...t, midi: 90 })),
  };
  const result = await designExercise(
    body(),
    {},
    vi.fn().mockResolvedValue(Response.json(fixture("gemini", bad))),
  );
  expect(result.status).toBe(502);
  expect(result.body).toHaveProperty(
    "error",
    expect.stringContaining("range and timing"),
  );
});
it("handles quota errors and timeouts without returning raw provider details", async () => {
  const quota = await designExercise(
    body(),
    {},
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "sensitive-provider-detail" }, { status: 429 }),
      ),
  );
  expect(quota.status).toBe(429);
  expect(JSON.stringify(quota.body)).not.toContain("sensitive-provider-detail");
  const timeout = await designExercise(
    body(),
    {},
    vi.fn().mockRejectedValue(new DOMException("fixture", "TimeoutError")),
  );
  expect(timeout.status).toBe(502);
  expect(timeout.body).toHaveProperty(
    "error",
    expect.stringContaining("too long"),
  );
});
it.each([
  { ...body(), profile: { ...profile, high: 47 } },
  { ...body(), profile: { ...profile, coach: "invented" } },
  { ...body(), profile: { ...profile, goals: [100] } },
  { ...body(), sessions: Array(6).fill({}) },
  {
    ...body(),
    ai: {
      provider: "gemini",
      key: "fixture",
      baseURL: "https://untrusted.example",
    },
  },
])("rejects invalid context before an upstream request %#", async (request) => {
  const fetcher = vi.fn();
  expect((await designExercise(request, {}, fetcher)).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
