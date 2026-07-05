import { deleteWorkflow, getWorkflow, updateWorkflow } from "@/lib/workflow";
import { parseWorkflowInput, ValidationError } from "@/lib/validate-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const workflow = await getWorkflow(id);
  if (!workflow)
    return Response.json({ error: "Workflow not found" }, { status: 404 });
  return Response.json({ workflow });
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await request.json();
    const input = parseWorkflowInput(body);
    const workflow = await updateWorkflow(id, input);
    if (!workflow)
      return Response.json({ error: "Workflow not found" }, { status: 404 });
    return Response.json({ workflow });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to update workflow" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteWorkflow(id);
  if (!ok) return Response.json({ error: "Workflow not found" }, { status: 404 });
  return Response.json({ ok: true });
}
