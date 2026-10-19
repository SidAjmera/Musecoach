import { describe, it, expect } from "vitest";
import {
  MAX_BYTES,
  microphoneError,
  validateDuration,
  validateUpload,
} from "../../lib/validation";
import { comparable } from "../../lib/comparison";
import { makeExercise } from "../../lib/exercises";
import { defaultProfile, Session } from "../../lib/types";
describe("recording validation", () => {
  it.each(["wav", "mp3", "m4a", "ogg", "webm"])(
    "allows the %s extension for browser decoding",
    (ext) =>
      expect(
        validateUpload({ name: `take.${ext}`, size: 500, type: "audio/test" }),
      ).toBeNull(),
  );
  it("rejects unsupported, empty, and oversized uploads", () => {
    expect(validateUpload({ name: "file.exe", size: 200, type: "" })).toContain(
      "Choose a WAV",
    );
    expect(validateUpload({ name: "take.wav", size: 0, type: "" })).toContain(
      "empty",
    );
    expect(
      validateUpload({ name: "take.wav", size: MAX_BYTES + 1, type: "" }),
    ).toContain("25 MB");
    expect(
      validateUpload({ name: "take.WAV", size: MAX_BYTES, type: "" }),
    ).toBeNull();
  });
  it("enforces 15–60 seconds with a small codec padding tolerance", () => {
    expect(validateDuration(14.99)).toContain("at least 15");
    expect(validateDuration(15)).toBeNull();
    expect(validateDuration(60)).toBeNull();
    expect(validateDuration(61)).toContain("15 and 60");
    expect(validateDuration(NaN)).not.toBeNull();
  });
  it("provides actionable microphone errors", () => {
    expect(microphoneError({ name: "NotAllowedError" })).toContain(
      "site settings",
    );
    expect(microphoneError({ name: "NotFoundError" })).toContain(
      "Connect a microphone",
    );
    expect(microphoneError({ name: "NotReadableError" })).toContain("busy");
  });
});
describe("comparisons", () => {
  function session(id: string, context: string, base = 60): Session {
    return {
      id,
      date: "2026-10-19",
      title: "Take",
      context,
      analysis: {
        version: "yin-1.0",
        exercise:
          context === "free"
            ? undefined
            : makeExercise("match", base, defaultProfile),
      },
    } as Session;
  }
  it("compares only matching references and versions", () => {
    expect(comparable(session("1", "match"), session("2", "match"))).toBe(true);
    expect(comparable(session("1", "match"), session("2", "match", 62))).toBe(
      false,
    );
    expect(comparable(session("1", "free"), session("2", "free"))).toBe(false);
    const next = session("2", "match");
    next.analysis.version = "other";
    expect(comparable(session("1", "match"), next)).toBe(false);
  });
});
