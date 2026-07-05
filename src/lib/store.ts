import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RunResult, Task, TaskInput } from "./types";

// Tasks are persisted as a JSON file so saved tasks survive restarts and can be
// re-run any time. Kept intentionally simple — no database required.
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

async function readAll(): Promise<Task[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(tasks: Task[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), "utf8");
}

export async function listTasks(): Promise<Task[]> {
  const tasks = await readAll();
  return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTask(id: string): Promise<Task | undefined> {
  const tasks = await readAll();
  return tasks.find((t) => t.id === id);
}

export async function createTask(input: TaskInput): Promise<Task> {
  const tasks = await readAll();
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    name: input.name,
    url: input.url,
    steps: input.steps,
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  await writeAll(tasks);
  return task;
}

export async function updateTask(
  id: string,
  input: TaskInput,
): Promise<Task | undefined> {
  const tasks = await readAll();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  tasks[idx] = {
    ...tasks[idx],
    name: input.name,
    url: input.url,
    steps: input.steps,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(tasks);
  return tasks[idx];
}

export async function deleteTask(id: string): Promise<boolean> {
  const tasks = await readAll();
  const next = tasks.filter((t) => t.id !== id);
  if (next.length === tasks.length) return false;
  await writeAll(next);
  return true;
}

/** Persist the result of the most recent run for a task. */
export async function saveRunResult(
  id: string,
  result: RunResult,
): Promise<void> {
  const tasks = await readAll();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;
  tasks[idx].lastRun = result;
  await writeAll(tasks);
}
