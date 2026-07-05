import { getWorkflow, saveWorkflowRun } from "@/lib/workflow";
import { executeWorkflow } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const workflow = await getWorkflow(id);
  if (!workflow)
    return Response.json({ error: "Workflow not found" }, { status: 404 });

  const result = await executeWorkflow(workflow.nodes, workflow.edges);
  await saveWorkflowRun(id, result);
  return Response.json({ result });
}
