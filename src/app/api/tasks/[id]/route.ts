import { deleteTask, getTask, updateTask } from "@/lib/store";
import { parseTaskInput, ValidationError } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return Response.json({ task });
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await request.json();
    const input = parseTaskInput(body);
    const task = await updateTask(id, input);
    if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
    return Response.json({ task });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteTask(id);
  if (!ok) return Response.json({ error: "Task not found" }, { status: 404 });
  return Response.json({ ok: true });
}
