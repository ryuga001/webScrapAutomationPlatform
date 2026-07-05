"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Workflow } from "@/lib/workflow";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/workflows");
    const data = await res.json();
    setWorkflows(data.workflows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/workflows");
      const data = await res.json();
      if (!cancelled) {
        setWorkflows(data.workflows ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(wf: Workflow) {
    if (!confirm(`Delete workflow "${wf.name}"?`)) return;
    await fetch(`/api/workflows/${wf.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="min-h-screen bg-surface px-8 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold tracking-tight text-primary">
                WebBot
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold text-on-surface">
              Workflows
            </h1>
            <p className="mt-1 text-on-surface-variant">
              Build website automations from atomic nodes, then run them any time.
            </p>
          </div>
          <Link
            href="/workflows/new"
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90"
          >
            + New workflow
          </Link>
        </header>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : workflows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-12 text-center">
            <p className="text-on-surface">No workflows yet.</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Create your first automation with “New workflow”.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="flex flex-col rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h2 className="font-display text-lg font-semibold text-on-surface">
                    {wf.name}
                  </h2>
                  {wf.lastRun && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        wf.lastRun.ok
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {wf.lastRun.ok ? "Passed" : "Failed"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {wf.nodes.length} node{wf.nodes.length === 1 ? "" : "s"} ·{" "}
                  {wf.edges.length} connection{wf.edges.length === 1 ? "" : "s"}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="rounded-lg bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container hover:opacity-90"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleDelete(wf)}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:border-rose-400 hover:text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
