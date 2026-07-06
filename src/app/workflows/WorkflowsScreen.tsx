"use client";

import { Workflow as WorkflowIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkflows } from "@/hooks/useWorkflows";
import { useDownloadExtension } from "@/hooks/useDownloadExtension";
import { Sidebar, type NavItem } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { WorkflowGrid } from "./components/WorkflowGrid";
import { EmptyState } from "./components/EmptyState";

const NAV: NavItem[] = [
  { label: "Automations", icon: WorkflowIcon, href: "/workflows", active: true },
];

export function WorkflowsScreen() {
  const { user, logout } = useAuth();
  const { loading, query, setQuery, filteredWorkflows, deleteWorkflow } =
    useWorkflows();
  const { downloading, downloadExtension } = useDownloadExtension();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar navigation={NAV} onLogout={logout} />

      <main className="ml-60 flex min-h-screen flex-col">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          downloading={downloading}
          onDownload={downloadExtension}
          user={user}
        />

        <div className="mx-auto w-full max-w-6xl flex-1 p-8">
          {loading ? (
            <p className="text-on-surface-variant">Loading…</p>
          ) : (
            <WorkflowGrid workflows={filteredWorkflows} onDelete={deleteWorkflow} />
          )}

          {!loading && filteredWorkflows.length === 0 && query && (
            <EmptyState query={query} />
          )}
        </div>
      </main>
    </div>
  );
}
