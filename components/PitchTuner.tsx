"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch } from "@/lib/analysis";
import { hzMidi, noteName } from "@/lib/exercises";
import { microphoneError } from "@/lib/validation";

export default function PitchTuner({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [running, setRunning] = useState(false),
    [pending, setPending] = useState(false),
    [pitch, setPitch] = useState<number | null>(null),
    [db, setDb] = useState(-120),
    [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null),
    context = useRef<AudioContext | null>(null),
    frame = useRef(0),
    generation = useRef(0);
  const release = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (context.current && context.current.state !== "closed")
      void context.current.close();
    context.current = null;
  }, []);
  useEffect(() => () => release(), [release]);
  useEffect(() => {
    if (disabled) {
      release();
      setRunning(false);
      setPending(false);
      setPitch(null);
    }
  }, [disabled, release]);
  async function start() {
    release();
    setError("");
    setPitch(null);
    setDb(-120);
    setPending(true);
    const token = generation.current;
    let captured: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone check needs a supported browser on HTTPS.");
      captured = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (token !== generation.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      const ctx = new AudioContext();
      context.current = ctx;
      await ctx.resume();
      if (token !== generation.current) return;
      const source = ctx.createMediaStreamSource(captured),
        analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let last = -Infinity;
      const tick = (now: number) => {
        if (token !== generation.current) return;
        if (now - last >= 120) {
          last = now;
          analyser.getFloatTimeDomainData(samples);
          const detected = detectPitch(samples, ctx.sampleRate);
          setPitch(detected.hz);
          setDb(Math.round(20 * Math.log10(Math.max(detected.rms, 1e-6))));
        }
        frame.current = requestAnimationFrame(tick);
      };
      setPending(false);
      setRunning(true);
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      captured?.getTracks().forEach((track) => track.stop());
      if (token === generation.current) {
        release();
        setPending(false);
        setRunning(false);
        setError(microphoneError(e));
      }
    }
  }
  const midi = pitch ? hzMidi(pitch) : null,
    cents = midi === null ? 0 : Math.round((midi - Math.round(midi)) * 100);
  return (
    <section className="panel tuner-panel">
      <span className="eyebrow">MICROPHONE CHECK · LIVE PITCH</span>
      <h3>Find your signal first.</h3>
      <p className="small muted">
        Try a comfortable hum. Check your input and explore notes before a take.
        Nothing is recorded or uploaded.
      </p>
      <div className="tuner-reading" role="status" aria-live="off">
        <strong>{midi === null ? "—" : noteName(midi)}</strong>
        <span>
          {pitch
            ? `${Math.round(pitch)} Hz · ${cents > 0 ? "+" : ""}${cents} cents from nearest note`
            : running
              ? "Waiting for a clear note"
              : "Microphone off"}
        </span>
      </div>
      <meter
        min={-80}
        max={0}
        low={-55}
        high={-6}
        optimum={-20}
        value={db}
        aria-label="Microphone input level"
      />
      {running && (
        <p className="small muted">
          {db} dBFS ·{" "}
          {db > -3
            ? "Input is very loud; move back."
            : db < -65
              ? "Very quiet input. Move closer and check microphone permissions."
              : pitch
                ? "Pitch detected. You’re ready to record."
                : "Sound received; try a steady vowel in a quiet space."}
        </p>
      )}
      <button
        className="button secondary"
        disabled={disabled || pending}
        onClick={() => {
          if (running) {
            release();
            setRunning(false);
            setPitch(null);
          } else void start();
        }}
      >
        {pending
          ? "Waiting for microphone…"
          : running
            ? "Stop microphone check"
            : "Start microphone check"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
