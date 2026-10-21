"use client";
import { useEffect, useRef, useState } from "react";
import { decodeAudio, runAnalysis } from "@/lib/audio";
import {
  buildSongReference,
  SONG_STORAGE_KEY,
  Song,
  validSong,
  validateSongReference,
} from "@/lib/song-reference";
import { Exercise, Profile } from "@/lib/types";
import { validateUpload } from "@/lib/validation";

export default function SongPractice({
  profile,
  onUse,
}: {
  profile: Profile;
  onUse: () => void;
}) {
  const [query, setQuery] = useState(""),
    [songs, setSongs] = useState<Song[]>([]),
    [selected, setSelected] = useState<Song>(),
    [reference, setReference] = useState<Exercise>(),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [searching, setSearching] = useState(false),
    [loading, setLoading] = useState(false),
    [guide, setGuide] = useState<Blob>(),
    [guideURL, setGuideURL] = useState("");
  const request = useRef<AbortController | null>(null),
    cancel = useRef<() => void>(() => {}),
    generation = useRef(0),
    player = useRef<HTMLAudioElement>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      generation.current++;
      cancel.current();
    },
    [],
  );
  useEffect(() => {
    if (!guide) {
      setGuideURL("");
      return;
    }
    const url = URL.createObjectURL(guide);
    setGuideURL(url);
    return () => URL.revokeObjectURL(url);
  }, [guide]);
  async function search() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(
        `/api/songs?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Song search failed. Try again.");
      if (!Array.isArray(data.songs) || !data.songs.every(validSong))
        throw new Error("Song search returned invalid results.");
      setSongs(data.songs);
      setStatus(
        data.songs.length
          ? `${data.songs.length} songs found.`
          : "No matching songs. Try a different title or artist.",
      );
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  async function loadGuide(file: File) {
    if (!selected) return;
    const token = ++generation.current;
    setError("");
    setReference(undefined);
    setGuide(undefined);
    const invalid = validateUpload(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setStatus("Finding the guide's notes on your device…");
    try {
      const decoded = await decodeAudio(file);
      if (token !== generation.current) return;
      if (decoded.duration > 57)
        throw new Error(
          "Use a guide between 15 and 57 seconds, leaving room for the count-in.",
        );
      const task = runAnalysis(decoded.samples, decoded.sampleRate);
      cancel.current = task.cancel;
      const analysis = await task.promise;
      if (token !== generation.current) return;
      const exercise = buildSongReference(selected, analysis, profile);
      setReference(exercise);
      setGuide(file);
      setStatus(
        `${exercise.targets.length} estimated note targets ready. Listen and check the guide before practising.`,
      );
    } catch (e) {
      if (token === generation.current) {
        setError((e as Error).message);
        setStatus("");
      }
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }
  return (
    <section className="panel song-practice">
      <details>
        <summary>Practise a real song</summary>
        <p>
          Search by title or artist, then load your own 15–57 second solo-vocal
          guide. Musecoach estimates its notes locally so you can sing the same
          phrase and compare pitch. Use a guide you have permission to use. The
          guide needs at least five seconds of clear notes, each lasting 0.4
          seconds or longer.
        </p>
        <p className="small muted">
          Search provides song information, not song audio, backing tracks or
          official sheet music. Full mixes are unsuitable for this pitch
          detector. Guide audio stays on this device; only your search text goes
          to the catalogue.
        </p>
        <form
          className="song-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label>
            Song title or artist
            <input
              value={query}
              minLength={2}
              maxLength={120}
              required
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="button secondary"
            disabled={searching || loading || query.trim().length < 2}
          >
            {searching ? "Searching songs…" : "Search songs"}
          </button>
        </form>
        <p className="small muted">
          Song information from{" "}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">
            MusicBrainz
          </a>
          . No API key needed.
        </p>
        <ul className="song-results">
          {songs.map((song) => (
            <li key={song.id}>
              <button
                className="button secondary"
                disabled={loading}
                aria-pressed={selected?.id === song.id}
                onClick={() => {
                  player.current?.pause();
                  setSelected(song);
                  setReference(undefined);
                  setGuide(undefined);
                  setStatus("");
                  setError("");
                }}
              >
                {song.title} · {song.artist}
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <div>
            <h3>{selected.title}</h3>
            <p>
              {selected.artist} ·{" "}
              <a
                href={`https://musicbrainz.org/recording/${selected.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Catalogue details
              </a>
            </p>
            <label>
              Load solo-vocal song guide
              <input
                key={selected.id}
                type="file"
                accept=".wav,.mp3,.m4a,.ogg,.webm"
                disabled={loading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void loadGuide(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        )}
        {guideURL && (
          <audio
            ref={player}
            src={guideURL}
            controls
            preload="metadata"
            aria-label="Your local song guide"
          />
        )}
        {reference && (
          <div>
            <p>
              Estimated guide: {reference.targets.length} notes ·{" "}
              {reference.duration.toFixed(1)} seconds including count-in.
              Targets must fit your comfortable range. Compare with this guide,
              not the original artist's performance.
            </p>
            <button
              className="button primary"
              onClick={() => {
                try {
                  const clean = validateSongReference(reference, profile);
                  localStorage.setItem(SONG_STORAGE_KEY, JSON.stringify(clean));
                  player.current?.pause();
                  onUse();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Practise this song phrase
            </button>
          </div>
        )}
        {status && <p role="status">{status}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </details>
    </section>
  );
}
