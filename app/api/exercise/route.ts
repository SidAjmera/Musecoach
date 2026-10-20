import { designExercise } from "@/lib/exercise-design-server";
export const runtime = "nodejs";
export const maxDuration = 45;
const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Open exercise design from your Musecoach studio." },
      { status: 403, headers },
    );
  if (Number(request.headers.get("content-length") || 0) > 40000)
    return Response.json(
      { error: "Request too large." },
      { status: 413, headers },
    );
  const raw = await request.text();
  if (raw.length > 40000)
    return Response.json(
      { error: "Request too large." },
      { status: 413, headers },
    );
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400, headers },
    );
  }
  const result = await designExercise(body);
  return Response.json(result.body, { status: result.status, headers });
}
