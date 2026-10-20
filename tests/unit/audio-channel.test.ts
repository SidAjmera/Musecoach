import { expect, it } from "vitest";
import { strongestChannel } from "../../lib/audio";
import { analyzeSamples } from "../../lib/analysis";

it("preserves pitch when stereo channels have opposite phase", () => {
  const left = Float32Array.from(
    { length: 12000 * 16 },
    (_, i) => 0.003 * Math.sin((2 * Math.PI * 220 * i) / 12000),
  );
  const right = left.map((x) => -x);
  const chosen = strongestChannel([left, right]);
  expect(analyzeSamples(chosen, 12000).coverage).toBeGreaterThan(0.9);
  expect(analyzeSamples(chosen, 12000).score).not.toBeNull();
});
it("chooses the useful channel when the other channel is silent", () => {
  const silent = new Float32Array(1024),
    voice = silent.map((_, i) => 0.02 * Math.sin(i));
  expect(strongestChannel([silent, voice])).toBe(voice);
});
