import { pickElement } from "@/lib/picker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return Response.json({ error: "A URL is required" }, { status: 400 });
    try {
      new URL(url);
    } catch {
      return Response.json({ error: "URL must be absolute (include https://)" }, { status: 400 });
    }
    const mode = body?.mode === "list" ? "list" : "single";
    const result = await pickElement(url, mode);
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
