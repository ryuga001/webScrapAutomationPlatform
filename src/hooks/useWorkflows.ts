"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Workflow } from "@/lib/workflow";
import { computeWorkflowStats } from "@/lib/workflow-stats";

export function useWorkflows() {
  const { authFetch } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    const res = await authFetch("/api/workflows");
    const data = await res.json().catch(() => ({}));
    setWorkflows(data.workflows ?? []);
  }, [authFetch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authFetch("/api/workflows");
      const data = await res.json().catch(() => ({}));
      if (!cancelled) {
        setWorkflows(data.workflows ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const deleteWorkflow = useCallback(
    async (wf: Workflow) => {
      if (!confirm(`Delete workflow "${wf.name}"?`)) return;
      await authFetch(`/api/workflows/${wf.id}`, { method: "DELETE" });
      await reload();
    },
    [authFetch, reload],
  );

  const filteredWorkflows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? workflows.filter((w) => w.name.toLowerCase().includes(q)) : workflows;
  }, [workflows, query]);

  const stats = useMemo(() => computeWorkflowStats(workflows), [workflows]);

  return {
    workflows,
    loading,
    query,
    setQuery,
    filteredWorkflows,
    deleteWorkflow,
    reload,
    stats,
  };
}
