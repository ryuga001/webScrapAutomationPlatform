"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STEP_ACTIONS,
  SELECTOR_ACTIONS,
  VALUE_ACTIONS,
  LOCATOR_TYPES,
  ELEMENT_ROLES,
} from "@/lib/types";
import type {
  LocatorType,
  RunResult,
  Step,
  StepAction,
  StepErrorType,
  Task,
} from "@/lib/types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyStep(): Step {
  return { id: uid(), action: "click", locatorType: "text" };
}

const ERROR_LABELS: Record<StepErrorType, string> = {
  not_found: "Not found",
  ambiguous: "Ambiguous",
  timeout: "Timed out",
  navigation: "Navigation",
  assertion: "Assertion",
  invalid: "Invalid step",
  error: "Error",
};

type Editor = {
  id: string | null; // null => creating a new task
  name: string;
  url: string;
  steps: Step[];
};

function newEditor(): Editor {
  return { id: null, name: "", url: "https://", steps: [] };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [viewResult, setViewResult] = useState<{ name: string; result: RunResult } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!cancelled) {
        setTasks(data.tasks ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(task: Task) {
    if (!confirm(`Delete task "${task.name}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    await load();
  }

  async function handleRun(task: Task) {
    setRunningId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.result) setViewResult({ name: task.name, result: data.result });
      await load();
    } finally {
      setRunningId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Playwright automation
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Tasks</h1>
            <p className="mt-2 text-sm text-slate-400">
              Build a browser automation, test it, and save it to re-run any time.
            </p>
          </div>
          <button
            onClick={() => setEditor(newEditor())}
            className="shrink-0 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            + New task
          </button>
        </header>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <p className="text-slate-300">No tasks yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Create your first automation with the “New task” button.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-medium">{task.name}</h2>
                      {task.lastRun && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            task.lastRun.ok
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {task.lastRun.ok ? "Last run passed" : "Last run failed"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-cyan-300/80">{task.url}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.steps.length} step{task.steps.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => handleRun(task)}
                      disabled={runningId === task.id}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {runningId === task.id ? "Running…" : "▶ Run"}
                    </button>
                    {task.lastRun && (
                      <button
                        onClick={() => setViewResult({ name: task.name, result: task.lastRun! })}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500"
                      >
                        Results
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setEditor({
                          id: task.id,
                          name: task.name,
                          url: task.url,
                          steps: task.steps.map((s) => ({ ...s })),
                        })
                      }
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task)}
                      className="rounded-lg border border-rose-900/60 px-3 py-1.5 text-sm text-rose-300 transition hover:border-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor && (
        <TaskEditor
          editor={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await load();
          }}
          onShowResult={(result) => setViewResult({ name: editor.name || "Test run", result })}
        />
      )}

      {viewResult && (
        <ResultModal
          name={viewResult.name}
          result={viewResult.result}
          onClose={() => setViewResult(null)}
        />
      )}
    </main>
  );
}

function TaskEditor({
  editor,
  onChange,
  onClose,
  onSaved,
  onShowResult,
}: {
  editor: Editor;
  onChange: (e: Editor) => void;
  onClose: () => void;
  onSaved: () => void;
  onShowResult: (r: RunResult) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<Editor>) {
    onChange({ ...editor, ...patch });
  }

  function updateStep(id: string, patch: Partial<Step>) {
    update({ steps: editor.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  function addStep() {
    update({ steps: [...editor.steps, emptyStep()] });
  }

  function removeStep(id: string) {
    update({ steps: editor.steps.filter((s) => s.id !== id) });
  }

  function moveStep(index: number, dir: -1 | 1) {
    const next = [...editor.steps];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ steps: next });
  }

  async function handleTest() {
    setError(null);
    setTesting(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editor.url, steps: editor.steps }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Test failed");
        return;
      }
      onShowResult(data.result);
    } catch {
      setError("Could not reach the server");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const method = editor.id ? "PUT" : "POST";
      const path = editor.id ? `/api/tasks/${editor.id}` : "/api/tasks";
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editor.name, url: editor.url, steps: editor.steps }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onSaved();
    } catch {
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {editor.id ? "Edit task" : "New task"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Name</label>
            <input
              value={editor.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Login smoke test"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Start URL</label>
            <input
              value={editor.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Steps</label>
              <button
                onClick={addStep}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500"
              >
                + Add step
              </button>
            </div>

            {editor.steps.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-500">
                No steps. The task will just open the URL. Add steps to interact.
              </p>
            ) : (
              <ol className="space-y-2">
                {editor.steps.map((step, i) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    index={i}
                    total={editor.steps.length}
                    onChange={(patch) => updateStep(step.id, patch)}
                    onRemove={() => removeStep(step.id)}
                    onMove={(dir) => moveStep(i, dir)}
                  />
                ))}
              </ol>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-lg border border-cyan-600 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/10 disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test with Playwright"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : editor.id ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  step: Step;
  index: number;
  total: number;
  onChange: (patch: Partial<Step>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const needsSelector = SELECTOR_ACTIONS.includes(step.action);
  const needsValue = VALUE_ACTIONS.includes(step.action);
  const meta = STEP_ACTIONS.find((a) => a.value === step.action);
  const locType = step.locatorType ?? "css";
  const locMeta = LOCATOR_TYPES.find((l) => l.value === locType);

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400">
          {index + 1}
        </span>
        <select
          value={step.action}
          onChange={(e) => onChange({ action: e.target.value as StepAction })}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm outline-none focus:border-cyan-500"
        >
          {STEP_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded px-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded px-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            className="rounded px-1.5 text-rose-400 hover:text-rose-300"
            title="Remove step"
          >
            ✕
          </button>
        </div>
      </div>

      {needsSelector && (
        <div className="mt-2 flex flex-col gap-2 pl-8 sm:flex-row">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Find by</span>
            <select
              value={locType}
              onChange={(e) => {
                const lt = e.target.value as LocatorType;
                onChange({
                  locatorType: lt,
                  role: lt === "role" ? (step.role ?? "button") : undefined,
                });
              }}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm outline-none focus:border-cyan-500"
            >
              {LOCATOR_TYPES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          {locType === "role" && (
            <select
              value={step.role ?? "button"}
              onChange={(e) => onChange({ role: e.target.value })}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm outline-none focus:border-cyan-500"
            >
              {ELEMENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          <input
            value={step.selector ?? ""}
            onChange={(e) => onChange({ selector: e.target.value })}
            placeholder={locMeta?.placeholder ?? "Identifier"}
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm outline-none focus:border-cyan-500"
          />
        </div>
      )}
      {needsValue && (
        <div className="mt-2 pl-8">
          <input
            value={step.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={
              step.action === "waitForTimeout"
                ? "Milliseconds"
                : step.action === "press"
                  ? "Key (e.g. Enter)"
                  : step.action === "goto"
                    ? "URL"
                    : step.action === "expectText"
                      ? "Text to expect"
                      : "Value / text to enter"
            }
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm outline-none focus:border-cyan-500"
          />
        </div>
      )}
      <p className="mt-1.5 pl-8 text-xs text-slate-500">
        {needsSelector && locMeta ? locMeta.hint : meta?.hint}
      </p>
    </li>
  );
}

function ResultModal({
  name,
  result,
  onClose,
}: {
  name: string;
  result: RunResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{name}</h2>
            <p
              className={`mt-1 text-sm font-medium ${
                result.ok ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {result.ok ? "✓ Passed" : "✗ Failed"} · {result.durationMs}ms ·{" "}
              {result.steps.length} steps
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {result.error && (
          <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {result.error}
          </p>
        )}

        <ol className="space-y-1.5">
          {result.steps.map((s) => (
            <li
              key={s.index}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-sm">
                  {s.skipped ? "⏭️" : s.ok ? "✅" : "❌"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-200">{s.description}</p>
                    {s.errorType && (
                      <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                        {ERROR_LABELS[s.errorType]}
                      </span>
                    )}
                  </div>
                  {s.message && (
                    <p className="mt-1 break-words text-xs text-rose-300/90">
                      {s.message}
                    </p>
                  )}
                  {s.detail && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                        Technical details
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-950 p-2 font-mono text-[11px] leading-snug text-slate-400">
                        {s.detail}
                      </pre>
                    </details>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {s.skipped ? "skipped" : `${s.durationMs}ms`}
                </span>
              </div>
              {s.screenshot && (
                <a
                  href={s.screenshot}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block overflow-hidden rounded-md border border-slate-800"
                  title="Open full screenshot"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.screenshot}
                    alt={`After step ${s.index}`}
                    className="max-h-56 w-full object-cover object-top transition hover:opacity-90"
                  />
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
