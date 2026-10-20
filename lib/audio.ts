import { Analysis, Exercise } from "./types";
import { validateDuration } from "./validation";
import { midiHz } from "./exercises";
export function strongestChannel(channels: Float32Array[]): Float32Array {
  // Selecting a channel avoids stereo phase cancellation during mono downmixing.
  let best = channels[0],
    bestEnergy = -1;
  for (const channel of channels) {
    let energy = 0;
    for (const sample of channel) energy += sample * sample;
    if (energy > bestEnergy) {
      best = channel;
      bestEnergy = energy;
    }
  }
  return best;
}
export class BrowserRecorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private context?: AudioContext;
  private raf = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private cancelled = false;
  async start(
    onLevel: (n: number) => void,
    onStop: (blob: Blob) => void,
    maxSeconds = 60,
  ) {
    this.cancelled = false;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    if (this.cancelled) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.stream = stream;
    try {
      this.context = new AudioContext();
      await this.context.resume();
      if (this.cancelled) {
        this.cleanup();
        return false;
      }
      const source = this.context.createMediaStreamSource(stream),
        analyser = this.context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser); // Deliberately never connect microphone to destination.
      const bins = new Float32Array(analyser.fftSize);
      const meter = () => {
        analyser.getFloatTimeDomainData(bins);
        let power = 0;
        for (const x of bins) power += x * x;
        onLevel(
          Math.max(
            0,
            Math.min(
              1,
              (20 * Math.log10(Math.max(Math.sqrt(power / bins.length), 1e-6)) +
                65) /
                60,
            ),
          ),
        );
        this.raf = requestAnimationFrame(meter);
      };
      meter();
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      this.recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      const chunks: BlobPart[] = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      this.recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: this.recorder?.mimeType || "audio/webm",
        });
        this.cleanup();
        if (!this.cancelled) onStop(blob);
      };
      this.recorder.start(250);
      this.timer = setTimeout(() => this.stop(), maxSeconds * 1000);
      return true;
    } catch (e) {
      this.cleanup();
      throw e;
    }
  }
  stop() {
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.cleanup();
  }
  dispose() {
    this.cancelled = true;
    this.stop();
  }
  private cleanup() {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    if (this.context && this.context.state !== "closed")
      void this.context.close();
  }
}
export async function decodeAudio(
  blob: Blob,
): Promise<{ samples: Float32Array; duration: number; sampleRate: number }> {
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const error = validateDuration(audio.duration);
    if (error) throw new Error(error);
    const rate = 12000,
      offline = new OfflineAudioContext(
        1,
        Math.ceil(audio.duration * rate),
        rate,
      );
    const source = offline.createBufferSource();
    const mono = offline.createBuffer(1, audio.length, audio.sampleRate);
    mono
      .getChannelData(0)
      .set(
        strongestChannel(
          Array.from({ length: audio.numberOfChannels }, (_, i) =>
            audio.getChannelData(i),
          ),
        ),
      );
    source.buffer = mono;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return {
      samples: rendered.getChannelData(0),
      duration: audio.duration,
      sampleRate: rate,
    };
  } catch (e) {
    if (e instanceof Error && /15|60/.test(e.message)) throw e;
    throw new Error(
      "This browser couldn’t decode the audio. Try exporting it as WAV or MP3, then upload again.",
    );
  } finally {
    await ctx.close();
  }
}
export function runAnalysis(
  samples: Float32Array,
  sampleRate: number,
  exercise?: Exercise,
): { promise: Promise<Analysis>; cancel: () => void } {
  const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
  let cancel = () => {};
  const promise = new Promise<Analysis>((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Analysis took too long. Try a shorter recording."));
    }, 60000);
    cancel = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("Analysis cancelled."));
    };
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result);
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(
        new Error("Analysis worker could not start. Reload and try again."),
      );
    };
    worker.postMessage({ samples, sampleRate, exercise }, [samples.buffer]);
  });
  return { promise, cancel: () => cancel() };
}
export class TonePlayer {
  private ctx?: AudioContext;
  private nodes: OscillatorNode[] = [];
  async play(notes: { midi: number; start: number; duration: number }[]) {
    this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    await ctx.resume();
    if (this.ctx !== ctx) return;
    const now = ctx.currentTime + 0.08;
    for (const n of notes) {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = midiHz(n.midi);
      gain.gain.setValueAtTime(0, now + n.start);
      gain.gain.linearRampToValueAtTime(0.16, now + n.start + 0.03);
      gain.gain.setValueAtTime(
        0.16,
        now + n.start + Math.max(0.03, n.duration - 0.05),
      );
      gain.gain.linearRampToValueAtTime(0, now + n.start + n.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.duration + 0.02);
      this.nodes.push(osc);
    }
    const end = Math.max(...notes.map((n) => n.start + n.duration));
    setTimeout(
      () => {
        if (this.ctx === ctx) this.stop();
      },
      (end + 0.3) * 1000,
    );
  }
  stop() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
    }
    this.nodes = [];
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = undefined;
  }
}
