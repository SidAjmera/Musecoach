import { Analysis, Exercise, PitchFrame } from "./types";
import { hzMidi, noteName, isSequenceExercise } from "./exercises";
export const ANALYSIS_VERSION = "yin-1.1";
export const PITCH_CONFIDENCE = 0.8;
export const quantile = (values: number[], p: number) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length
    ? s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))]
    : 0;
};
export function detectPitch(
  frame: Float32Array,
  sampleRate: number,
): { hz: number | null; confidence: number; rms: number } {
  let energy = 0,
    mean = 0;
  for (const x of frame) mean += x;
  mean /= frame.length;
  for (const x of frame) energy += (x - mean) ** 2;
  const rms = Math.sqrt(energy / frame.length);
  // Periodicity is amplitude-independent. Quiet phone recordings must not be
  // discarded by a gate intended for normalised studio audio (-42 dBFS).
  if (!Number.isFinite(rms) || rms < 0.0001)
    return { hz: null, confidence: 0, rms: Number.isFinite(rms) ? rms : 0 };
  const min = Math.max(2, Math.floor(sampleRate / 1400)),
    max = Math.min(
      Math.floor(sampleRate / 55),
      Math.floor(frame.length / 2) - 1,
    ),
    half = Math.floor(frame.length / 2);
  const d = new Float64Array(max + 1);
  let sum = 0;
  for (let tau = 1; tau <= max; tau++) {
    let v = 0;
    for (let j = 0; j < half; j++) {
      const delta = frame[j] - frame[j + tau];
      v += delta * delta;
    }
    sum += v;
    d[tau] = sum ? (v * tau) / sum : 1;
  }
  for (let tau = min; tau < max; tau++) {
    if (d[tau] < 1 - PITCH_CONFIDENCE) {
      while (tau + 1 < max && d[tau + 1] < d[tau]) tau++;
      const conf = 1 - d[tau];
      const prev = d[tau - 1],
        next = d[tau + 1],
        den = 2 * (2 * d[tau] - next - prev);
      const refined = tau + (den ? (next - prev) / den : 0);
      return {
        hz: conf >= PITCH_CONFIDENCE ? sampleRate / refined : null,
        confidence: conf,
        rms,
      };
    }
  }
  return { hz: null, confidence: 0, rms };
}
export function summarize(
  frames: PitchFrame[],
  duration: number,
  clipping: number,
  exercise?: Exercise,
): Analysis {
  const voiced = frames.filter(
    (f) => f.hz !== null && f.confidence >= PITCH_CONFIDENCE,
  );
  const hop = frames.length > 1 ? frames[1].time - frames[0].time : 0.05;
  const voicedSeconds = voiced.length * hop,
    coverage = voicedSeconds / duration;
  const pitches = voiced.map((f) => hzMidi(f.hz!));
  const range: Analysis["range"] = pitches.length
    ? [quantile(pitches, 0.05), quantile(pitches, 0.95)]
    : null;
  const result: Analysis = {
    version: ANALYSIS_VERSION,
    duration,
    frames,
    voicedSeconds,
    coverage,
    range,
    metrics: [],
    score: null,
    warnings: [],
    strengths: [],
    improvements: [],
    observations: [],
    recommendation: "hold",
    formula:
      "No score: at least 1.5 seconds of confident pitch and 10% coverage are required.",
    exercise,
  };
  result.metrics.push(
    {
      key: "inputLevel",
      label: "Recording level",
      value: Math.round(
        20 *
          Math.log10(
            Math.max(
              Math.sqrt(
                frames.reduce((sum, f) => sum + f.rms ** 2, 0) /
                  Math.max(1, frames.length),
              ),
              1e-6,
            ),
          ),
      ),
      unit: "dBFS",
    },
    {
      key: "voiced",
      label: "Confident pitch detected",
      value: Math.round(coverage * 100),
      unit: "% of take",
    },
    {
      key: "clipping",
      label: "Clipped samples",
      value: Math.round(clipping * 10000) / 100,
      unit: "%",
    },
  );
  if (
    voiced.length &&
    quantile(
      voiced.map((f) => f.rms),
      0.5,
    ) < 0.004
  )
    result.warnings.push(
      "Your recording is quiet, but usable pitch was detected. Move a little closer to the microphone for a cleaner next take; there is no need to sing louder.",
    );
  if (clipping > 0.005)
    result.warnings.push(
      "Clipping detected. Move farther from the microphone or lower its input gain, then record again.",
    );
  if (coverage < 0.35)
    result.warnings.push(
      "Much of this take has no confident pitch. Try solo singing in a quiet room, closer to your microphone. Accompaniment and noise can confuse the detector.",
    );
  if (voicedSeconds < 1.5 || coverage < 0.1) {
    result.warnings.push(
      "Too little usable pitched audio for a reliable practice score. Silence, speech, or noise may be present.",
    );
    result.improvements.push(
      "Record a clear, comfortable vowel for 15–30 seconds in a quiet room.",
    );
    return result;
  }
  const db = voiced.map((f) => 20 * Math.log10(Math.max(f.rms, 1e-6)));
  result.metrics.push({
    key: "loudness",
    label: "Loudness variation",
    value: Math.round((quantile(db, 0.9) - quantile(db, 0.1)) * 10) / 10,
    unit: "dB (10–90%)",
  });
  const stable: { time: number; dev: number }[] = [];
  for (let i = 0; i + 11 < frames.length; i += 6) {
    const chunk = frames.slice(i, i + 12);
    if (chunk.filter((f) => f.hz !== null).length < 11) continue;
    const p = chunk
      .filter((f) => f.hz !== null)
      .map((f) => hzMidi(f.hz!) * 100);
    if (quantile(p, 0.9) - quantile(p, 0.1) > 180) continue;
    const center = quantile(p, 0.5);
    stable.push({
      time: chunk[0].time,
      dev: quantile(
        p.map((v) => Math.abs(v - center)),
        0.5,
      ),
    });
  }
  if (stable.length >= 3) {
    const dev = quantile(
        stable.map((s) => s.dev),
        0.5,
      ),
      score = Math.round(Math.max(0, 100 - dev));
    result.metrics.push({
      key: "stability",
      label: "Sustained-note steadiness",
      value: Math.round(dev * 10) / 10,
      unit: "cents median deviation",
      score,
    });
    result.score = score;
    result.formula =
      "Practice indicator = 100 − median absolute pitch deviation in cents, clamped to 0–100. Only ≥0.6-second near-steady windows count. This describes steadiness, not melody correctness or talent.";
    const best = [...stable].sort((a, b) => a.dev - b.dev)[0];
    result.observations.push({
      time: best.time,
      text: `A steady window: ${best.dev.toFixed(1)} cents median deviation over 0.6 seconds.`,
    });
    result.strengths.push(
      `We found ${stable.length} near-steady windows with a median deviation of ${dev.toFixed(1)} cents.`,
    );
    result.improvements.push(
      "Explore a gentle held note, then compare its movement. Vibrato and expressive slides can be intentional.",
    );
  } else {
    result.formula =
      "No free-singing indicator: fewer than three usable near-steady windows. Try the hold-a-note exercise for a defined comparison.";
    result.improvements.push(
      "Try holding a comfortable note to give the detector a clearer sustained sample.",
    );
  }
  if (range)
    result.strengths.push(
      `Confident pitches in the middle 90% of this take span ${noteName(range[0])} to ${noteName(range[1])}. This is not your full vocal range.`,
    );
  if (exercise) {
    const scored = scoreExercise(frames, exercise);
    result.metrics.push(...scored.metrics);
    result.score = scored.score;
    result.formula = scored.formula;
    result.observations.push(...scored.observations);
    result.recommendation =
      scored.score !== null && scored.score >= 80 ? "melody" : "match";
    if (scored.score !== null)
      result.improvements.unshift(
        "Replay a target, then repeat it on a comfortable “oo”. Leave a clear gap between notes.",
      );
  }
  return result;
}
export function scoreExercise(frames: PitchFrame[], exercise: Exercise) {
  const hop = frames.length > 1 ? frames[1].time - frames[0].time : 0.05;
  // Estimate a single global latency from voiced onsets, without tuning against pitch correctness.
  const onsets = frames
    .filter((f, i) => f.hz !== null && (i === 0 || frames[i - 1].hz === null))
    .map((f) => f.time);
  const offsets = exercise.targets.flatMap((t) => {
    const near = onsets.filter((o) => Math.abs(o - t.start) <= 0.6);
    return near.length
      ? [
          near.sort(
            (a, b) => Math.abs(a - t.start) - Math.abs(b - t.start),
          )[0] - t.start,
        ]
      : [];
  });
  const latency = offsets.length >= 2 ? quantile(offsets, 0.5) : 0;
  let expected = 0,
    matched = 0,
    correct = 0;
  const errors: number[] = [],
    observations: { time: number; text: string }[] = [],
    timingErrors: number[] = [];
  for (const t of exercise.targets) {
    const active = frames.filter(
      (f) =>
        f.time >= t.start + latency + 0.15 &&
        f.time < t.start + latency + t.duration - 0.1,
    );
    expected += Math.max(1, (t.duration - 0.25) / hop);
    const pitched = active.filter((f) => f.hz !== null);
    matched += pitched.length;
    const cents = pitched.map((f) =>
      Math.abs(1200 * Math.log2(f.hz! / (440 * 2 ** ((t.midi - 69) / 12)))),
    );
    correct += cents.filter((e) => e <= 50).length;
    errors.push(...cents);
    const near = onsets
      .filter((o) => Math.abs(o - (t.start + latency)) <= 0.9)
      .sort(
        (a, b) =>
          Math.abs(a - t.start - latency) - Math.abs(b - t.start - latency),
      );
    if (near.length) timingErrors.push(Math.abs(near[0] - t.start - latency));
    if (cents.length >= 5)
      observations.push({
        time: Math.max(0, t.start + latency),
        text: `Target ${noteName(t.midi)}: median absolute error ${Math.round(quantile(cents, 0.5))} cents in its interior. (${t.duration}s target)`,
      });
  }
  const coverage = Math.min(1, matched / expected);
  if (coverage < 0.3 || errors.length < 20)
    return {
      score: null,
      metrics: [],
      observations,
      formula:
        "No exercise score: confident pitch must cover at least 30% of target interiors, with at least 20 usable frames.",
    };
  const pitch = Math.round((correct / Math.max(matched, 1)) * 100);
  const metrics = [
    {
      key: "accuracy",
      label: "Pitch within ±50 cents",
      value: pitch,
      unit: "% of detected target frames",
      score: pitch,
    },
    {
      key: "targetCoverage",
      label: "Target coverage",
      value: Math.round(coverage * 100),
      unit: "%",
    },
  ];
  let score = pitch;
  let formula =
    "Exercise score = percentage of confidently pitched target-interior frames within ±50 cents of the defined reference. Missing audio is reported as coverage, not pitch error.";
  if (isSequenceExercise(exercise.kind) && timingErrors.length >= 4) {
    const ms = quantile(timingErrors, 0.5) * 1000,
      timing = Math.round(Math.max(0, 100 - ms / 5));
    metrics.push({
      key: "timing",
      label: "Onset timing deviation",
      value: Math.round(ms),
      unit: "ms after latency adjustment",
      score: timing,
    });
    score = Math.round(pitch * 0.8 + timing * 0.2);
    formula =
      "Exercise score = 80% pitch accuracy (±50 cents) + 20% onset timing score (100 − median onset error in ms / 5, clamped to 0–100).";
  } else if (isSequenceExercise(exercise.kind))
    formula +=
      " Timing is unavailable: fewer than four distinct nearby onsets; only pitch is scored.";
  metrics.push({
    key: "latency",
    label: "Estimated global latency",
    value: Math.round(latency * 1000),
    unit: "ms",
  });
  return { score, metrics, observations, formula };
}
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  exercise?: Exercise,
): Analysis {
  const frames: PitchFrame[] = [];
  let clipped = 0;
  for (const s of samples) if (Math.abs(s) >= 0.995) clipped++;
  const step = Math.round(sampleRate * 0.05);
  for (let i = 0; i + 1024 <= samples.length; i += step) {
    frames.push({
      time: i / sampleRate,
      ...detectPitch(samples.subarray(i, i + 1024), sampleRate),
    });
  }
  return summarize(
    frames,
    samples.length / sampleRate,
    clipped / samples.length,
    exercise,
  );
}
