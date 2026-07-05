import { executeWorkflow } from "@/lib/engine";
import { parseWorkflowInput, ValidationError } from "@/lib/validate-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ad-hoc "Test run" — executes the current canvas graph without persisting.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Reuse workflow validation but tolerate a missing name for test runs.
    const input = parseWorkflowInput({ name: "Test run", ...body });
    const result = await executeWorkflow(input.nodes, input.edges);
    return Response.json({ result });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to run workflow" }, { status: 500 });
  }
}
