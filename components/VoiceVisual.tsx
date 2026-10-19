"use client";

import { useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";

const messages = [
  { name: "Sunny", message: "A little courage. One more try.", initial: "S" },
  { name: "Theo", message: "Let’s find your next small step.", initial: "T" },
  {
    name: "Kai",
    message: "Your voice. Your pace. You’ve got this.",
    initial: "K",
  },
];

export default function VoiceVisual() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`voice-visual${paused ? " is-paused" : ""}`}>
      <span className="voice-visual-label">ROOM FOR YOUR VOICE</span>
      <button
        type="button"
        className="voice-motion-toggle"
        aria-label={
          paused ? "Play waveform animation" : "Pause waveform animation"
        }
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={13} /> : <Pause size={13} />}
      </button>
      <svg
        className="voice-waveform"
        viewBox="0 0 360 280"
        role="img"
        aria-label="Animated sound waves with sample encouragement from the coaches"
      >
        <circle
          cx="180"
          cy="140"
          r="100"
          fill="none"
          stroke="currentColor"
          opacity=".1"
        />
        <circle
          cx="180"
          cy="140"
          r="126"
          fill="none"
          stroke="currentColor"
          opacity=".07"
        />
        <path d="M0 140h360" stroke="currentColor" opacity=".12" />
        {Array.from({ length: 43 }, (_, i) => {
          const height =
            14 +
            Math.pow(Math.sin((i / 42) * Math.PI), 1.6) *
              (40 + ((i * 37) % 90));
          return (
            <rect
              key={i}
              className="voice-wave-bar"
              x={12 + i * 8}
              y={140 - height / 2}
              width="3"
              height={height}
              rx="1.5"
              fill={i % 5 === 0 ? "#efbd92" : "#c6d8b8"}
              style={
                {
                  "--wave-duration": `${1.2 + (i % 7) * 0.19}s`,
                  "--wave-delay": `${-i * 0.13}s`,
                } as CSSProperties
              }
            />
          );
        })}
      </svg>
      <div
        className="voice-coach-messages"
        aria-label="Sample coach encouragement"
      >
        {messages.map((item, i) => (
          <div
            className={`voice-coach-bubble voice-coach-bubble-${i}`}
            key={item.name}
          >
            <span className="voice-coach-initial" aria-hidden="true">
              {item.initial}
            </span>
            <span>
              <strong>
                {item.name} <span>· Your coach</span>
              </strong>
              <span className="voice-coach-message">{item.message}</span>
            </span>
          </div>
        ))}
      </div>
      <span className="voice-visual-caption">Your coach, for you.</span>
    </div>
  );
}
