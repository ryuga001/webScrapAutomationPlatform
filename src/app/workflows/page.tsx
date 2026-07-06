import { RequireAuth } from "@/components/RequireAuth";
import { WorkflowsScreen } from "./WorkflowsScreen";

export default function WorkflowsPage() {
  return (
    <RequireAuth>
      <WorkflowsScreen />
    </RequireAuth>
  );
}
