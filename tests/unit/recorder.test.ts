import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRecorder } from "../../lib/audio";
describe("microphone lifecycle", () => {
  let stop = vi.fn(),
    close = vi.fn(),
    getUserMedia = vi.fn();
  beforeEach(() => {
    stop = vi.fn();
    close = vi.fn();
    getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        resume = async () => {};
        close = async () => {
          this.state = "closed";
          close();
        };
        createMediaStreamSource() {
          return { connect: vi.fn() };
        }
        createAnalyser() {
          return {
            fftSize: 1024,
            getFloatTimeDomainData: (a: Float32Array) => a.fill(0),
          };
        }
      },
    );
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        mimeType = "audio/webm";
        state = "inactive";
        ondataavailable?: (e: { data: Blob }) => void;
        onstop?: () => void;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["audio"]) });
          this.onstop?.();
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it("surfaces permission denial and does not leave resources", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    const r = new BrowserRecorder();
    await expect(
      r.start(
        () => {},
        () => {},
      ),
    ).rejects.toMatchObject({ name: "NotAllowedError" });
    r.dispose();
    expect(stop).not.toHaveBeenCalled();
  });
  it("stops tracks and audio context on normal stop and emits playback data", async () => {
    const output = vi.fn(),
      r = new BrowserRecorder();
    await r.start(() => {}, output);
    r.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(output).toHaveBeenCalledWith(expect.any(Blob));
  });
  it("disposes when navigating away without delivering a recording", async () => {
    const output = vi.fn(),
      r = new BrowserRecorder();
    await r.start(() => {}, output);
    r.dispose();
    expect(stop).toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
  });
  it("cleans up a permission request that resolves after abandonment", async () => {
    let resolve!: (s: unknown) => void;
    getUserMedia.mockReturnValue(new Promise((r) => (resolve = r)));
    const r = new BrowserRecorder(),
      pending = r.start(
        () => {},
        () => {},
      );
    r.dispose();
    resolve({ getTracks: () => [{ stop }] });
    expect(await pending).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("cleans up if MediaRecorder construction fails", async () => {
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        constructor() {
          throw new Error("codec unavailable");
        }
      },
    );
    const r = new BrowserRecorder();
    await expect(
      r.start(
        () => {},
        () => {},
      ),
    ).rejects.toThrow("codec");
    expect(stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
  it("automatically stops at the requested maximum", async () => {
    vi.useFakeTimers();
    const output = vi.fn(),
      r = new BrowserRecorder();
    await r.start(() => {}, output, 60);
    await vi.advanceTimersByTimeAsync(60000);
    expect(stop).toHaveBeenCalled();
    expect(output).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
