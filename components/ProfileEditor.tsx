"use client";
import { useEffect, useState } from "react";
import { X, ArrowRight, Check, ChevronLeft } from "lucide-react";
import { Profile } from "@/lib/types";
import { coaches } from "@/lib/coaches";
import { noteName } from "@/lib/exercises";
import Avatar from "./Avatar";
import { selectSpeechVoice } from "@/lib/speech";
export default function ProfileEditor({
  initial,
  onSave,
  onClose,
  onboarding = false,
}: {
  initial: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
  onboarding?: boolean;
}) {
  const [p, setP] = useState(initial),
    [step, setStep] = useState(0),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const listener = () => setVoices(window.speechSynthesis?.getVoices() || []);
    listener();
    window.speechSynthesis?.addEventListener("voiceschanged", listener);
    const dialog = document.querySelector<HTMLDialogElement>("#profile-dialog");
    dialog?.showModal();
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", listener);
      previous?.focus();
    };
  }, []);
  const toggle = (key: "goals" | "genres", value: string) =>
    setP({
      ...p,
      [key]: p[key].includes(value)
        ? p[key].filter((v) => v !== value)
        : [...p[key], value],
    });
  function version(v: Profile["version"], coach = p.coach) {
    setP({
      ...p,
      coach,
      version: v,
      ...(v !== "custom"
        ? {
            appearance:
              v === "male" ? ("masculine" as const) : ("feminine" as const),
            pronouns: v === "male" ? "he/him" : "she/her",
            register: v === "male" ? ("low" as const) : ("high" as const),
            voice: "",
          }
        : {}),
    });
  }
  return (
    <dialog
      id="profile-dialog"
      className="profile-dialog"
      onCancel={onClose}
      aria-labelledby="profile-title"
    >
      <div className="modal-top">
        <span className="eyebrow">
          {onboarding ? "LET’S MAKE THIS YOURS" : "YOUR STUDIO, YOUR WAY"}
        </span>
        <button
          className="icon-button"
          aria-label="Close profile"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="step-dots" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((s) => (
          <button
            key={s}
            aria-label={`Go to step ${s + 1}`}
            className={step === s ? "active" : ""}
            onClick={() => setStep(s)}
          />
        ))}
      </div>
      <h2 id="profile-title">
        {
          ["Meet your voice.", "Find your kind of coach.", "Make it personal."][
            step
          ]
        }
      </h2>
      <p className="muted">
        {
          [
            "A few details help shape your practice. You can change these anytime.",
            "Ten original personalities. Every coach can be customized: choose their appearance, pronouns, and voice on the next step.",
            "Coach presentation is personal. Your own comfortable range guides every exercise.",
          ][step]
        }
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) setStep(step + 1);
          else onSave(p);
        }}
      >
        {step === 0 && (
          <div className="form-stack">
            <label>
              What should we call you? <span className="muted">Optional</span>
              <input
                autoFocus
                value={p.name}
                maxLength={40}
                placeholder="Your preferred name"
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </label>
            <label>
              Your singing experience
              <select
                value={p.experience}
                onChange={(e) => setP({ ...p, experience: e.target.value })}
              >
                <option value="beginner">Beginner — finding my voice</option>
                <option value="intermediate">
                  Intermediate — building consistency
                </option>
                <option value="advanced">
                  Advanced — refining the details
                </option>
              </select>
            </label>
            <fieldset>
              <legend>What would you like to explore?</legend>
              <div className="chips">
                {[
                  "Pitch stability",
                  "Timing",
                  "Expression",
                  "Confidence",
                  "Range exploration",
                ].map((g) => (
                  <button
                    type="button"
                    className={p.goals.includes(g) ? "chip selected" : "chip"}
                    aria-pressed={p.goals.includes(g)}
                    key={g}
                    onClick={() => toggle("goals", g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>
                Your favourite genres <span className="muted">Optional</span>
              </legend>
              <div className="chips">
                {[
                  "Pop",
                  "R&B",
                  "Soul",
                  "Indie",
                  "Jazz",
                  "Musical theatre",
                  "Classical",
                  "Rock",
                ].map((g) => (
                  <button
                    type="button"
                    className={p.genres.includes(g) ? "chip selected" : "chip"}
                    aria-pressed={p.genres.includes(g)}
                    key={g}
                    onClick={() => toggle("genres", g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        {step === 1 && (
          <div className="coach-grid">
            {coaches.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  if (p.coach !== c.id)
                    version(
                      p.version === "custom" ? "custom" : c.defaultVersion,
                      c.id,
                    );
                }}
                aria-pressed={p.coach === c.id}
                className={`coach-option ${p.coach === c.id ? "selected" : ""}`}
              >
                <Avatar
                  coach={c.id}
                  appearance={p.coach === c.id ? p.appearance : undefined}
                />
                <span>
                  <strong>{c.id}</strong>
                  <small>{c.traits}</small>
                </span>
                {p.coach === c.id && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="form-stack">
            <fieldset>
              <legend>Version of {p.coach}</legend>
              <div className="segmented">
                {(["female", "male", "custom"] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    className={p.version === v ? "selected" : ""}
                    aria-pressed={p.version === v}
                    onClick={() => version(v)}
                  >
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="small muted">
              Male / female presets set appearance, pronouns, and a low / high
              demonstration register. Browser voices vary; choose one below to
              fit your preference.
            </p>
            <div className="form-two">
              <label>
                Appearance
                <select
                  disabled={p.version !== "custom"}
                  value={p.appearance}
                  onChange={(e) =>
                    setP({
                      ...p,
                      appearance: e.target.value as Profile["appearance"],
                    })
                  }
                >
                  <option value="feminine">Feminine</option>
                  <option value="masculine">Masculine</option>
                  <option value="androgynous">Androgynous</option>
                </select>
              </label>
              <label>
                Pronouns
                <input
                  disabled={p.version !== "custom"}
                  value={p.pronouns}
                  maxLength={30}
                  onChange={(e) => setP({ ...p, pronouns: e.target.value })}
                />
              </label>
            </div>
            <label>
              Speaking voice
              <select
                value={p.voice}
                onChange={(e) => setP({ ...p, voice: e.target.value })}
              >
                <option value="">
                  Automatic preset or device default · preview to choose
                </option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                if (!window.speechSynthesis) return;
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(
                  `Hello, I’m ${p.coach}. Let’s make room for your voice.`,
                );
                u.voice = selectSpeechVoice(p, voices);
                window.speechSynthesis.speak(u);
              }}
            >
              Preview speaking voice
            </button>
            {voices.length === 0 && (
              <p className="small muted">
                No browser voices are available on this device. Text coaching is
                still available.
              </p>
            )}
            <label>
              Synthesised demonstration register
              <select
                value={p.register}
                onChange={(e) =>
                  setP({
                    ...p,
                    register: e.target.value as Profile["register"],
                  })
                }
              >
                <option value="low">Low · reference C3</option>
                <option value="middle">Middle · reference C4</option>
                <option value="high">High · reference C5</option>
              </select>
            </label>
            <fieldset>
              <legend>
                Comfortable exercise range{" "}
                <span className="muted">Optional · provisional</span>
              </legend>
              <div className="form-two">
                <label>
                  Lower note
                  <select
                    value={p.low}
                    onChange={(e) =>
                      setP({
                        ...p,
                        low: Number(e.target.value),
                        rangeSet: true,
                        rangeProvisional: true,
                      })
                    }
                  >
                    {Array.from({ length: 41 }, (_, i) => i + 36)
                      .filter((n) => n < p.high)
                      .map((n) => (
                        <option key={n} value={n}>
                          {noteName(n)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Upper note
                  <select
                    value={p.high}
                    onChange={(e) =>
                      setP({
                        ...p,
                        high: Number(e.target.value),
                        rangeSet: true,
                        rangeProvisional: true,
                      })
                    }
                  >
                    {Array.from({ length: 49 }, (_, i) => i + 40)
                      .filter((n) => n > p.low)
                      .map((n) => (
                        <option key={n} value={n}>
                          {noteName(n)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <p className="small muted">
                Default starting window: C3–C5. Adjust to notes that feel easy
                for you. You can also try range exploration in Practice. This
                isn’t a voice classification.
              </p>
            </fieldset>
          </div>
        )}
        <div className="modal-actions">
          {step > 0 ? (
            <button
              type="button"
              className="text-button"
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button type="button" className="text-button" onClick={onClose}>
              Explore first
            </button>
          )}
          <button className="button primary" type="submit">
            {step === 2 ? "Save my preferences" : "Continue"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
