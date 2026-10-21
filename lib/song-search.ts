import { Song, validSong } from "./song-reference";

export async function searchSongs(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<Song[]> {
  const term = query.trim();
  if (term.length < 2 || term.length > 120)
    throw new Error(
      "Enter a song title or artist between 2 and 120 characters.",
    );
  const url = new URL("https://musicbrainz.org/ws/2/recording/");
  // Literal text only: prevent caller-supplied search operators or destinations.
  url.search = new URLSearchParams({
    query: term
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .map((word) => `"${word}"`)
      .join(" "),
    fmt: "json",
    limit: "12",
  }).toString();
  const response = await fetcher(url, {
    headers: {
      "User-Agent": "Musecoach/1.0 (https://github.com/SidAjmera/Musecoach)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
    redirect: "error",
    next: { revalidate: 3600 },
  });
  if (!response.ok)
    throw new Error(
      "Song search is temporarily unavailable. Please wait a moment and try again.",
    );
  const data = await response.json();
  if (!Array.isArray(data.recordings))
    throw new Error(
      "Song search returned an unexpected response. Try again later.",
    );
  return data.recordings
    .slice(0, 12)
    .flatMap((recording: Record<string, unknown>) => {
      if (!recording || typeof recording !== "object") return [];
      const credits = recording["artist-credit"];
      const artist = Array.isArray(credits)
        ? credits
            .map((c) => (typeof c?.name === "string" ? c.name : ""))
            .join(" / ")
            .slice(0, 200)
        : "";
      const song = {
        id: recording.id,
        title:
          typeof recording.title === "string"
            ? recording.title.slice(0, 200)
            : "",
        artist,
      };
      return validSong(song) ? [song] : [];
    });
}
