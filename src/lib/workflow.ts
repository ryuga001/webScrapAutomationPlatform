import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// A workflow is a graph: atomic nodes connected by edges. Each node carries the
// config it was given in the add/edit modal, keyed by the field names its type
// declares in the node registry (src/lib/nodes.ts).

export interface WorkflowNode {
  id: string;
  type: string; // matches a NodeTypeDef.type
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export interface NodeRunResult {
  nodeId: string;
  type: string;
  label: string;
  ok: boolean;
  message?: string;
  errorType?: string;
  detail?: string;
  durationMs: number;
  screenshot?: string;
  iteration?: number; // set for nodes run inside a loop
}

export interface WorkflowRunResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  nodes: NodeRunResult[];
  /** Named datasets collected during the run (for CSV preview/export). */
  datasets?: Record<string, Record<string, string>[]>;
  /** URLs of exported CSV files, keyed by dataset name. */
  csv?: Record<string, string>;
  /** URLs of exported .txt files, keyed by file name. */
  txt?: Record<string, string>;
  /** Text file contents, keyed by file name (for preview). */
  texts?: Record<string, string>;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  createdAt: string;
  updatedAt: string;
  lastRun?: WorkflowRunResult;
}

export interface WorkflowInput {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "workflows.json");

async function readAll(): Promise<Workflow[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Workflow[]) : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(items: Workflow[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listWorkflows(): Promise<Workflow[]> {
  const items = await readAll();
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  const items = await readAll();
  return items.find((w) => w.id === id);
}

export async function createWorkflow(input: WorkflowInput): Promise<Workflow> {
  const items = await readAll();
  const now = new Date().toISOString();
  const wf: Workflow = {
    id: randomUUID(),
    name: input.name,
    nodes: input.nodes,
    edges: input.edges,
    viewport: input.viewport,
    createdAt: now,
    updatedAt: now,
  };
  items.push(wf);
  await writeAll(items);
  return wf;
}

export async function updateWorkflow(
  id: string,
  input: WorkflowInput,
): Promise<Workflow | undefined> {
  const items = await readAll();
  const idx = items.findIndex((w) => w.id === id);
  if (idx === -1) return undefined;
  items[idx] = {
    ...items[idx],
    name: input.name,
    nodes: input.nodes,
    edges: input.edges,
    viewport: input.viewport,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(items);
  return items[idx];
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const items = await readAll();
  const next = items.filter((w) => w.id !== id);
  if (next.length === items.length) return false;
  await writeAll(next);
  return true;
}

export async function saveWorkflowRun(
  id: string,
  result: WorkflowRunResult,
): Promise<void> {
  const items = await readAll();
  const idx = items.findIndex((w) => w.id === id);
  if (idx === -1) return;
  items[idx].lastRun = result;
  await writeAll(items);
}
