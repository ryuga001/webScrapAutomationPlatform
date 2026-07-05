import { createTask, listTasks } from "@/lib/store";
import { parseTaskInput, ValidationError } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = await listTasks();
  return Response.json({ tasks });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseTaskInput(body);
    const task = await createTask(input);
    return Response.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to create task" }, { status: 500 });
  }
}
