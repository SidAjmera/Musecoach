import { answerBYOK, byokOptions } from "@/lib/byok-server";
export const runtime = "nodejs";
export const maxDuration = 45;
const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers });
}
export function GET() {
  return json(byokOptions(), { headers });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json(
      { error: "Please send the question from this Musecoach studio." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") || 0) > 40000)
    return json({ error: "Request too large." }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 40000)
    return json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  const result = await answerBYOK(body);
  return json(result.body, { status: result.status, headers });
}
