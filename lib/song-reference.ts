import { Analysis, Exercise, Profile, Target } from "./types";
import { hzMidi } from "./exercises";
import { PITCH_CONFIDENCE } from "./analysis";

export interface Song {
  id: string;
  title: string;
  artist: string;
}
export const SONG_STORAGE_KEY = "musecoach-song-reference";
export function validSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const s = value as Song;
  return (
    typeof s.id === "string" &&
    /^[a-f0-9-]{36}$/i.test(s.id) &&
    typeof s.title === "string" &&
    !!s.title.trim() &&
    s.title.length <= 200 &&
    typeof s.artist === "string" &&
    !!s.artist.trim() &&
    s.artist.length <= 200
  );
}
export function validateSongReference(
  value: unknown,
  profile: Pick<Profile, "low" | "high">,
): Exercise {
  const e = value as Exercise;
  const fail = () => {
    throw new Error(
      "Choose a song and load a clear solo-vocal guide within your comfortable range in Practice first.",
    );
  };
  if (
    !e ||
    !Number.isInteger(profile.low) ||
    !Number.isInteger(profile.high) ||
    profile.low < 36 ||
    profile.high > 88 ||
    profile.low > profile.high ||
    e.source !== "song" ||
    e.kind !== "melody" ||
    !validSong(e.song) ||
    !Number.isFinite(e.duration) ||
    e.duration < 18 ||
    e.duration > 60 ||
    !Array.isArray(e.targets) ||
    e.targets.length < 2 ||
    e.targets.length > 40
  )
    return fail();
  let end = 3;
  const targets = e.targets.map((t) => {
    if (
      !t ||
      !Number.isInteger(t.midi) ||
      t.midi < profile.low ||
      t.midi > profile.high ||
      !Number.isFinite(t.start) ||
      t.start < end - 1e-6 ||
      !Number.isFinite(t.duration) ||
      t.duration < 0.4 ||
      t.duration > 5 ||
      t.start + t.duration > e.duration + 1e-6
    )
      return fail();
    end = t.start + t.duration;
    return { midi: t.midi, start: t.start, duration: t.duration };
  });
  if (targets.reduce((sum, t) => sum + t.duration, 0) < 5) return fail();
  return {
    kind: "melody",
    source: "song",
    song: { id: e.song.id, title: e.song.title, artist: e.song.artist },
    name: `${e.song.title} · ${e.song.artist}`.slice(0, 90),
    duration: e.duration,
    base: targets[0].midi,
    targets,
    rationale:
      "Estimated notes from a locally supplied solo-vocal guide. Not an official song transcription.",
  };
}
export function buildSongReference(
  song: Song,
  analysis: Analysis,
  profile: Pick<Profile, "low" | "high">,
): Exercise {
  if (analysis.duration < 15 || analysis.duration > 57)
    throw new Error(
      "Choose a 15–57 second solo-vocal guide; three seconds are reserved for the count-in.",
    );
  const targets: Target[] = [];
  let segment: Target | undefined;
  const flush = () => {
    if (segment && segment.duration >= 0.4 - 1e-6)
      targets.push({ ...segment, duration: Math.max(0.4, segment.duration) });
    segment = undefined;
  };
  for (const f of analysis.frames) {
    const midi =
      f.hz !== null && f.confidence >= PITCH_CONFIDENCE
        ? Math.round(hzMidi(f.hz))
        : null;
    if (midi === null) {
      flush();
      continue;
    }
    const start = 3 + f.time;
    if (
      segment &&
      segment.midi === midi &&
      Math.abs(start - segment.start - segment.duration) < 0.02 &&
      segment.duration < 4
    ) {
      segment.duration = Math.min(4.05, start - segment.start + 0.05);
    } else {
      flush();
      segment = { midi, start, duration: 0.05 };
    }
  }
  flush();
  return validateSongReference(
    {
      kind: "melody",
      source: "song",
      song,
      duration: analysis.duration + 3,
      targets,
    },
    profile,
  );
}
export function readSongReference(profile: Pick<Profile, "low" | "high">) {
  const raw = localStorage.getItem(SONG_STORAGE_KEY);
  return validateSongReference(raw ? JSON.parse(raw) : null, profile);
}
