import { newCapture, runTask } from "@/lib/runner";
import { parseSteps, ValidationError } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ad-hoc "Test" run used by the editor before a task is saved.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) throw new ValidationError("A URL is required to test");
    try {
      new URL(url);
    } catch {
      throw new ValidationError("URL must be a valid absolute URL");
    }
    const steps = parseSteps(body?.steps);

    const result = await runTask(url, steps, newCapture());
    return Response.json({ result });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to run automation" }, { status: 500 });
  }
}
