import { createWorkflow, listWorkflows } from "@/lib/workflow";
import { parseWorkflowInput, ValidationError } from "@/lib/validate-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const workflows = await listWorkflows();
  return Response.json({ workflows });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseWorkflowInput(body);
    const workflow = await createWorkflow(input);
    return Response.json({ workflow }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to create workflow" }, { status: 500 });
  }
}
