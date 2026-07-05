"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronRight } from "lucide-react";
import { Palette } from "@/components/workflow/Palette";
import { NodeCard, type WebbotNodeData } from "@/components/workflow/NodeCard";
import { ConfigModal } from "@/components/workflow/ConfigModal";
import { RunResultPanel } from "@/components/workflow/RunResultPanel";
import { getNodeType } from "@/lib/nodes";
import { defaultConfig } from "@/lib/node-format";
import type { WorkflowRunResult } from "@/lib/workflow";

type ModalState =
  | { mode: "add"; nodeType: string; config: Record<string, unknown> }
  | {
      mode: "edit";
      nodeId: string;
      nodeType: string;
      config: Record<string, unknown>;
    };

const EDGE_OPTIONS = {
  type: "default",
  style: { stroke: "#22d3ee", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
};

let idSeq = 1;
const newNodeId = () => `n${Date.now()}_${idSeq++}`;

function Editor() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const isNew = id === "new";

  const [name, setName] = useState("Untitled workflow");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<null | "test" | "run">(null);
  const [result, setResult] = useState<WorkflowRunResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rf = useReactFlow();

  const nodeTypes = useMemo(() => ({ webbot: NodeCard }), []);

  // Load an existing workflow, or seed a blank one with a Start node.
  useEffect(() => {
    if (isNew) {
      setNodes([
        {
          id: newNodeId(),
          type: "webbot",
          position: { x: 80, y: 120 },
          data: { nodeType: "start", config: {} } satisfies WebbotNodeData,
        },
      ]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) {
        if (!cancelled) {
          setLoading(false);
          setToast("Workflow not found");
        }
        return;
      }
      const { workflow } = await res.json();
      if (cancelled) return;
      setName(workflow.name);
      setNodes(
        workflow.nodes.map((n: { id: string; type: string; position: { x: number; y: number }; config: Record<string, unknown> }) => ({
          id: n.id,
          type: "webbot",
          position: n.position,
          data: { nodeType: n.type, config: n.config } satisfies WebbotNodeData,
        })),
      );
      setEdges(
        workflow.edges.map((e: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) => ({
          ...e,
          ...EDGE_OPTIONS,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, ...EDGE_OPTIONS }, eds)),
    [setEdges],
  );

  // Palette click → open the config modal for a brand-new node.
  const handleAdd = useCallback((type: string) => {
    const def = getNodeType(type);
    if (!def) return;
    setModal({ mode: "add", nodeType: type, config: defaultConfig(def) });
  }, []);

  // Double-click an existing node → edit its config.
  const onNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    const d = node.data as WebbotNodeData;
    setModal({
      mode: "edit",
      nodeId: node.id,
      nodeType: d.nodeType,
      config: d.config,
    });
  }, []);

  const handleModalSave = useCallback(
    (config: Record<string, unknown>) => {
      if (!modal) return;
      if (modal.mode === "edit") {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === modal.nodeId
              ? { ...n, data: { ...(n.data as WebbotNodeData), config } }
              : n,
          ),
        );
      } else {
        setNodes((nds) => {
          // Place new nodes to the right of the rightmost node so they form a
          // natural left-to-right chain instead of stacking on top of each other.
          const rightmost = nds.reduce(
            (acc, n) => (n.position.x > acc.x ? { x: n.position.x, y: n.position.y } : acc),
            { x: 0, y: 120 },
          );
          const pos = nds.length
            ? { x: rightmost.x + 260, y: rightmost.y }
            : { x: 80, y: 120 };
          return [
            ...nds,
            {
              id: newNodeId(),
              type: "webbot",
              position: pos,
              data: { nodeType: modal.nodeType, config } satisfies WebbotNodeData,
            },
          ];
        });
      }
      setModal(null);
    },
    [modal, setNodes],
  );

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const buildPayload = useCallback(
    () => ({
      name,
      viewport: rf.getViewport(),
      nodes: nodes.map((n) => {
        const d = n.data as WebbotNodeData;
        return { id: n.id, type: d.nodeType, position: n.position, config: d.config };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    }),
    [name, nodes, edges, rf],
  );

  // Save the workflow; returns its id (creating it if new), or null on failure.
  const persist = useCallback(async (): Promise<string | null> => {
    const res = await fetch(isNew ? "/api/workflows" : `/api/workflows/${id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = await res.json();
    if (!res.ok) {
      flash(data.error ?? "Save failed");
      return null;
    }
    return data.workflow.id as string;
  }, [buildPayload, isNew, id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const savedId = await persist();
      if (savedId && isNew) router.replace(`/workflows/${savedId}`);
      else if (savedId) flash("Saved");
    } finally {
      setSaving(false);
    }
  }, [persist, isNew, router]);

  // Test run: execute the current canvas graph without saving.
  const handleTest = useCallback(async () => {
    setRunning("test");
    try {
      const res = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) flash(data.error ?? "Run failed");
      else setResult(data.result);
    } finally {
      setRunning(null);
    }
  }, [buildPayload]);

  // Run: save first, then execute the saved workflow (persists last run).
  const handleRun = useCallback(async () => {
    setRunning("run");
    try {
      const savedId = await persist();
      if (!savedId) return;
      if (isNew) router.replace(`/workflows/${savedId}`);
      const res = await fetch(`/api/workflows/${savedId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) flash(data.error ?? "Run failed");
      else setResult(data.result);
    } finally {
      setRunning(null);
    }
  }, [persist, isNew, router]);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Toolbar */}
      <header className="z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-6">
        <div className="flex items-center gap-4">
          <span className="font-display text-xl font-bold tracking-tight text-primary">
            WebBot
          </span>
          <div className="h-6 w-px bg-outline-variant" />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/workflows" className="text-on-surface-variant hover:text-primary">
              Workflows
            </Link>
            <ChevronRight size={16} className="text-on-surface-variant" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-72 rounded bg-transparent px-2 py-1 font-semibold text-on-surface outline-none hover:bg-surface-container focus:bg-surface-container"
            />
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={running !== null}
            title="Run the current canvas without saving"
            className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-surface hover:bg-surface-container disabled:opacity-60"
          >
            {running === "test" ? "Testing…" : "Test run"}
          </button>
          <button
            onClick={handleRun}
            disabled={running !== null}
            title="Save and run the workflow"
            className="rounded-lg bg-primary-container px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-primary-container hover:opacity-90 disabled:opacity-60"
          >
            {running === "run" ? "Running…" : "Run"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-primary hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Palette onAdd={handleAdd} />

        <div className="relative flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-on-surface-variant">
              Loading…
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={EDGE_OPTIONS}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={28} size={1.4} color="#c3cbe6" />
              <Controls className="!rounded-xl !border !border-outline-variant !bg-surface-container !shadow-lg" />
              <MiniMap
                pannable
                className="!rounded-xl !border !border-outline-variant !bg-surface-container"
                nodeColor="#7bd1fa"
              />
            </ReactFlow>
          )}

          {/* Empty hint */}
          {!loading && nodes.length <= 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-full bg-surface-container px-4 py-2 text-sm text-on-surface-variant shadow">
                Click a node in the palette to add it →
              </p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <ConfigModal
          nodeType={modal.nodeType}
          initialConfig={modal.config}
          isNew={modal.mode === "add"}
          defaultUrl={
            nodes
              .map((n) => n.data as WebbotNodeData)
              .find((d) => d.nodeType === "goto")?.config?.url as string | undefined
          }
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}

      {result && (
        <RunResultPanel result={result} onClose={() => setResult(null)} />
      )}

      {running && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-surface px-5 py-4 text-sm font-medium text-on-surface shadow-lg">
            Running workflow in Firefox…
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-on-surface px-4 py-2 text-sm font-medium text-surface shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function WorkflowEditorPage() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
