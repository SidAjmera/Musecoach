"use client";
import { useRef, useState } from "react";
import { Star } from "lucide-react";
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
  onFavorites,
}: {
  selected: ExerciseKind;
  profile: Profile;
  onSelect: (kind: ExerciseKind) => void;
  onFavorites: (kinds: ExerciseKind[]) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [favoritesOnly, setFavoritesOnly] = useState(false);
  const favoriteFilter = useRef<HTMLInputElement>(null);
  const favorites = profile.favoriteExercises;
  const visible = exerciseKinds.filter((kind) => {
    const e = exerciseInfo[kind];
    return (
      (category === "all" || e.category === category) &&
      (!favoritesOnly || favorites.includes(kind)) &&
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
          <h3>{exerciseKinds.length} ways to explore your voice.</h3>
        </div>
        <span className="tag">18 seconds each</span>
      </div>
      <label className="inline-check library-favorite-filter">
        <input
          ref={favoriteFilter}
          type="checkbox"
          checked={favoritesOnly}
          onChange={(e) => setFavoritesOnly(e.target.checked)}
        />
        Show favourites only ({favorites.length})
      </label>
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
          const favorite = favorites.includes(kind);
          return (
            <div className="library-tile" key={kind}>
              <button
                type="button"
                aria-label={e.label}
                aria-pressed={kind === selected}
                disabled={unavailable}
                className={`library-exercise ${kind === selected ? "selected" : ""}`}
                onClick={() => onSelect(kind)}
              >
                <span className="library-exercise-icon" aria-hidden="true">
                  {kind === selected ? "✓" : e.icon}
                </span>
                <span>
                  <strong>{e.label}</strong>
                  <small>
                    {unavailable
                      ? `Needs a ${exerciseSpan(kind)}-semitone range`
                      : `${e.category} · ${e.focus}`}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="favorite-toggle"
                aria-pressed={favorite}
                aria-label={
                  favorite
                    ? `Remove ${e.label} from favourites`
                    : `Add ${e.label} to favourites`
                }
                onClick={() => {
                  onFavorites(
                    favorite
                      ? favorites.filter((k) => k !== kind)
                      : [...favorites, kind],
                  );
                  if (favoritesOnly && favorite)
                    requestAnimationFrame(() =>
                      favoriteFilter.current?.focus(),
                    );
                }}
              >
                <Star size={17} fill={favorite ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="empty-inline">
          {favoritesOnly && favorites.length === 0
            ? "No favourites yet. Use the star beside an exercise to save it."
            : "No exercises match those filters. Try another focus, a shorter search, or turn off favourites only."}
        </p>
      )}
    </section>
  );
}
