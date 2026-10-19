"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Upload,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import {
  BrowserRecorder,
  decodeAudio,
  runAnalysis,
  TonePlayer,
} from "@/lib/audio";
import { validateUpload, microphoneError } from "@/lib/validation";
import { Exercise, Session } from "@/lib/types";
import { noteName, exerciseInfo } from "@/lib/exercises";
export default function Recorder({
  exercise,
  rangeExploration = false,
  onSave,
}: {
  exercise?: Exercise;
  rangeExploration?: boolean;
  onSave: (session: Session, blob?: Blob) => Promise<void>;
}) {
  const [status, setStatus] = useState<
      "idle" | "requesting" | "recording" | "decoding" | "ready" | "analyzing"
    >("idle"),
    [seconds, setSeconds] = useState(0),
    [level, setLevel] = useState(0),
    [error, setError] = useState(""),
    [blob, setBlob] = useState<Blob>(),
    [url, setUrl] = useState(""),
    [saveAudio, setSaveAudio] = useState(false),
    [title, setTitle] = useState(
      rangeExploration
        ? "Range exploration"
        : exercise
          ? exerciseInfo[exercise.kind].label
          : "Free singing",
    );
  const recorder = useRef<BrowserRecorder | null>(null),
    tones = useRef<TonePlayer | null>(null),
    decoded = useRef<Awaited<ReturnType<typeof decodeAudio>> | null>(null),
    cancelAnalysis = useRef<() => void>(() => {}),
    mounted = useRef(true),
    clock = useRef(0),
    audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorder.current?.dispose();
      tones.current?.stop();
      cancelAnalysis.current();
    };
  }, []);
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(
      () =>
        setSeconds(
          Math.min(
            (performance.now() - clock.current) / 1000,
            exercise?.duration || 60,
          ),
        ),
      100,
    );
    return () => clearInterval(timer);
  }, [status, exercise]);
  async function accept(b: Blob) {
    if (!mounted.current) return;
    setStatus("decoding");
    setError("");
    try {
      const result = await decodeAudio(b);
      if (!mounted.current) return;
      decoded.current = result;
      setBlob(b);
      setSeconds(result.duration);
      setStatus("ready");
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        setStatus("idle");
      }
    }
  }
  async function start() {
    setError("");
    setBlob(undefined);
    decoded.current = null;
    audio.current?.pause();
    tones.current?.stop();
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Microphone recording is unavailable in this browser. Use a current browser on HTTPS or localhost, or upload an audio file.",
      );
      return;
    }
    setStatus("requesting");
    recorder.current?.dispose();
    const r = new BrowserRecorder();
    recorder.current = r;
    try {
      const started = await r.start(
        (n) => {
          if (mounted.current) setLevel(n);
        },
        (b) => {
          void accept(b);
        },
        exercise?.duration || 60,
      );
      if (started && mounted.current) {
        clock.current = performance.now();
        setSeconds(0);
        setStatus("recording");
        if (exercise) {
          tones.current = new TonePlayer();
          void tones.current
            .play(
              [0, 1, 2].map((start) => ({ midi: 84, start, duration: 0.08 })),
            )
            .catch(() =>
              setError(
                "Count-in sound is unavailable. Follow the visual countdown.",
              ),
            );
        }
      }
    } catch (e) {
      if (mounted.current) {
        setError(microphoneError(e));
        setStatus("idle");
      }
    }
  }
  async function analyze() {
    if (!decoded.current || !blob) return;
    setError("");
    setStatus("analyzing");
    try {
      audio.current?.pause();
      tones.current?.stop();
      const task = runAnalysis(
        decoded.current.samples.slice(),
        decoded.current.sampleRate,
        exercise,
      );
      cancelAnalysis.current = task.cancel;
      const analysis = await task.promise;
      if (!mounted.current) return;
      const session: Session = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        title: title.trim() || "Untitled take",
        context: exercise?.kind || "free",
        analysis,
        audioSaved: saveAudio,
      };
      await onSave(session, saveAudio ? blob : undefined);
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        setStatus("ready");
      }
    }
  }
  const busy = ["requesting", "recording", "decoding", "analyzing"].includes(
      status,
    ),
    activeTarget = exercise?.targets.find(
      (t) => seconds >= t.start && seconds < t.start + t.duration,
    );
  return (
    <div className="record-layout">
      <section className="panel recording-panel">
        <div className="section-heading">
          <span className="tag">
            {exercise
              ? "Guided exercise"
              : rangeExploration
                ? "Gentle range exploration"
                : "Free singing"}
          </span>
          <span className="small muted">
            {exercise ? `${exercise.duration}s with count-in` : "15–60 seconds"}
          </span>
        </div>
        <div
          className={`record-orb ${status === "recording" ? "is-recording" : ""}`}
        >
          <div className="orb-inner">
            <Mic size={42} strokeWidth={1.3} />
          </div>
          <span className="orb-ring" />
        </div>
        <h2>
          {status === "recording"
            ? exercise
              ? seconds < 3
                ? `Ready in ${3 - Math.floor(seconds)}`
                : activeTarget
                  ? `Sing ${noteName(activeTarget.midi)}`
                  : "Rest · prepare for the next note"
              : "Your studio is listening."
            : "Make room for your voice."}
        </h2>
        <p className="record-description">
          {status === "requesting"
            ? "Allow microphone access in the browser prompt to begin."
            : status === "decoding"
              ? "Checking your audio and preparing a local copy…"
              : status === "analyzing"
                ? "Finding confident pitches and measuring this take, on your device…"
                : exercise
                  ? "Listen to the reference first. Recording starts with a three-beat count-in. Sing the highlighted targets; headphones help keep the count-in out of your take."
                  : rangeExploration
                    ? "On a gentle “oo”, explore a few notes that feel easy, pausing between phrases. Stay comfortable and stop if anything hurts. This is a provisional range check."
                    : "Choose a favourite phrase, or a comfortable “oo”. Solo singing in a quiet room gives the clearest picture."}
        </p>
        <div
          className="record-time"
          aria-label={`${seconds.toFixed(1)} seconds`}
        >
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
          :
          {Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0")}
          <span> / {exercise ? "00:18" : "01:00"}</span>
        </div>
        <div
          className="input-level"
          role="meter"
          aria-label="Microphone input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
        >
          {Array.from({ length: 28 }, (_, i) => (
            <i
              key={i}
              className={status === "recording" && i < level * 28 ? "lit" : ""}
            />
          ))}
        </div>
        <p className="small muted">
          {status === "recording"
            ? "Input level · microphone is active"
            : "Your microphone is off"}
        </p>
        <div className="record-actions">
          {status === "recording" ? (
            <button
              className="button stop"
              onClick={() => {
                tones.current?.stop();
                recorder.current?.stop();
                setStatus("decoding");
              }}
            >
              <Square size={17} fill="currentColor" /> Stop recording
            </button>
          ) : (
            <button className="button primary" onClick={start} disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Mic size={18} />
              )}{" "}
              {status === "requesting"
                ? "Waiting for permission"
                : status === "decoding"
                  ? "Preparing audio"
                  : status === "analyzing"
                    ? "Measuring your take"
                    : blob
                      ? "Record another take"
                      : "Start recording"}
            </button>
          )}
        </div>
        {status === "recording" && seconds < 15 && (
          <p className="small muted">
            Keep going: at least 15 seconds are needed. You can stop at any
            time.
          </p>
        )}
        {error && (
          <div className="notice warning" role="alert">
            {error}
          </div>
        )}
        {blob && (
          <div className="playback-box">
            <h3>Your take is ready.</h3>
            <audio
              ref={audio}
              src={url}
              controls
              onError={() =>
                setError(
                  "Playback failed in this browser. Try uploading WAV or MP3.",
                )
              }
            />
            <label className="take-title">
              Session name
              <input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy || rangeExploration}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saveAudio}
                onChange={(e) => setSaveAudio(e.target.checked)}
                disabled={busy}
              />{" "}
              Save audio in this browser with my session
            </label>
            <p className="small muted">
              Unchecked: only measurements are saved. No audio is uploaded to a
              server.
            </p>
            <div className="section-heading">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setBlob(undefined);
                  decoded.current = null;
                  setSeconds(0);
                  setStatus("idle");
                  setError("");
                }}
              >
                <RotateCcw size={15} /> Discard take
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={analyze}
              >
                Review my take <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
        <div className="upload-divider">
          <span>or bring your own recording</span>
        </div>
        <label className={`upload-area ${busy ? "disabled" : ""}`}>
          <Upload size={22} />
          <strong>Upload an audio file</strong>
          <span>WAV, MP3, M4A, OGG, WebM · up to 25 MB</span>
          <input
            aria-label="Upload an audio file"
            type="file"
            accept=".wav,.mp3,.m4a,.ogg,.webm"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const validation = validateUpload(file);
              if (validation) {
                setError(validation);
                return;
              }
              setBlob(undefined);
              decoded.current = null;
              void accept(file);
            }}
          />
        </label>
      </section>
      <aside className="record-sidebar">
        {exercise && (
          <section className="panel">
            <span className="eyebrow">YOUR REFERENCE</span>
            <h3>{exerciseInfo[exercise.kind].label}</h3>
            <div className="target-notes">
              {exercise.targets.map((t, i) => (
                <span className={activeTarget === t ? "active" : ""} key={i}>
                  {noteName(t.midi)}
                  <small>
                    {t.start}–{t.start + t.duration}s
                  </small>
                </span>
              ))}
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                tones.current ||= new TonePlayer();
                void tones.current
                  .play(
                    exercise.targets.map((t) => ({ ...t, start: t.start - 3 })),
                  )
                  .catch(() =>
                    setError(
                      "Reference playback is unavailable. Check browser audio permissions.",
                    ),
                  );
              }}
            >
              Play reference tones
            </button>
            <button
              className="text-button"
              onClick={() => tones.current?.stop()}
            >
              Stop reference
            </button>
            <p className="small muted">
              Synthesised tones, not a human singing demonstration. Sing only
              within your comfortable range. Timing starts with the recording;
              targets begin at 3s.
            </p>
          </section>
        )}
        <section className="panel recording-tips">
          <span className="eyebrow">A GOOD TAKE STARTS HERE</span>
          <h3>Just you, and a little space.</h3>
          <ol>
            <li>
              <strong>Find a quiet corner.</strong>
              <span>
                Turn down background music and keep a little distance from your
                mic.
              </span>
            </li>
            <li>
              <strong>Sing something comfortable.</strong>
              <span>
                No need to go high or loud. If singing causes pain, stop.
              </span>
            </li>
            <li>
              <strong>Listen before you submit.</strong>
              <span>
                You choose what to review and whether to keep the audio.
              </span>
            </li>
          </ol>
        </section>
        <div className="privacy-note">
          <ShieldCheck size={22} />
          <p>
            Your recording stays on your device. Local analysis is free and
            works without an AI provider.
          </p>
        </div>
      </aside>
    </div>
  );
}
