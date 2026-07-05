import { getTask, saveRunResult } from "@/lib/store";
import { newCapture, runTask } from "@/lib/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Automation runs can take a while; allow up to 5 minutes.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  const result = await runTask(task.url, task.steps, newCapture());
  await saveRunResult(id, result);
  return Response.json({ result });
}
