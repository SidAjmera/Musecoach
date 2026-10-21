import { searchSongs } from "@/lib/song-search";
export const runtime = "nodejs";
export const maxDuration = 15;
let nextSearch = 0;
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin)
    return Response.json(
      { error: "Search from Musecoach Practice." },
      { status: 403, headers },
    );
  const query = url.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 120 || !/[\p{L}\p{N}]/u.test(query))
    return Response.json(
      { error: "Enter a song title or artist between 2 and 120 characters." },
      { status: 400, headers },
    );
  if (Date.now() < nextSearch)
    return Response.json(
      { error: "Please wait a second before searching again." },
      { status: 429, headers: { ...headers, "Retry-After": "1" } },
    );
  nextSearch = Date.now() + 1100;
  try {
    return Response.json({ songs: await searchSongs(query) }, { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && error.name !== "TimeoutError"
            ? error.message
            : "Song search timed out. Try again.",
      },
      { status: 503, headers },
    );
  }
}
