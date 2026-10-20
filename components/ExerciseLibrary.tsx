"use client";
import { useState } from "react";
import {
  exerciseInfo,
  exerciseKinds,
  exerciseCategories,
  exerciseSpan,
} from "@/lib/exercises";
import { ExerciseKind, Profile } from "@/lib/types";

export default function ExerciseLibrary({
  selected,
  profile,
  onSelect,
}: {
  selected: ExerciseKind;
  profile: Profile;
  onSelect: (kind: ExerciseKind) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const visible = exerciseKinds.filter((kind) => {
    const e = exerciseInfo[kind];
    return (
      (category === "all" || e.category === category) &&
      `${e.label} ${e.description} ${e.focus}`
        .toLowerCase()
        .includes(query.toLowerCase().trim())
    );
  });
  return (
    <section className="panel exercise-library" aria-label="Exercise library">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR PRACTICE LIBRARY</span>
          <h3>30 ways to explore your voice.</h3>
        </div>
        <span className="tag">18 seconds each</span>
      </div>
      <p className="small muted">
        Choose one comfortable challenge. Every exercise has a defined reference
        and a measured review. Wider patterns unlock when your practice range
        allows them.
      </p>
      <div className="form-two library-filters">
        <label>
          Search exercises
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try thirds, rhythm, or scale"
          />
        </label>
        <label>
          Exercise focus
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All focuses</option>
            {exerciseCategories.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small muted" role="status">
        {visible.length} of {exerciseKinds.length} exercises
      </p>
      <div
        className="exercise-library-grid"
        role="group"
        aria-label="Exercise types"
      >
        {visible.map((kind) => {
          const e = exerciseInfo[kind],
            unavailable = exerciseSpan(kind) > profile.high - profile.low;
          return (
            <button
              key={kind}
              type="button"
              aria-label={e.label}
              aria-pressed={kind === selected}
              disabled={unavailable}
              className={`library-exercise ${kind === selected ? "selected" : ""}`}
              onClick={() => onSelect(kind)}
            >
              <span className="library-exercise-icon" aria-hidden="true">
                {e.icon}
              </span>
              <span>
                <strong>{e.label}</strong>
                <small>
                  {unavailable
                    ? `Needs a ${exerciseSpan(kind)}-semitone range`
                    : `${e.category} · ${e.focus}`}
                </small>
              </span>
              <span aria-hidden="true">{kind === selected ? "✓" : "↗"}</span>
            </button>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="empty-inline">
          No exercises match that search. Try another focus or a shorter search.
        </p>
      )}
    </section>
  );
}
