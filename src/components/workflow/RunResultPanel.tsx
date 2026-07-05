"use client";

import { X, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import type { WorkflowRunResult } from "@/lib/workflow";

export function RunResultPanel({
  result,
  onClose,
}: {
  result: WorkflowRunResult;
  onClose: () => void;
}) {
  const datasets = result.datasets ?? {};
  const csv = result.csv ?? {};
  const txt = result.txt ?? {};
  const texts = result.texts ?? {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <div className="flex items-center gap-2">
            {result.ok ? (
              <CheckCircle2 className="text-emerald-500" size={22} />
            ) : (
              <XCircle className="text-rose-500" size={22} />
            )}
            <div>
              <h2 className="font-display text-lg font-semibold text-on-surface">
                {result.ok ? "Run passed" : "Run failed"}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {result.nodes.length} nodes · {result.durationMs}ms
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {result.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {result.error}
            </p>
          )}

          {/* Dataset previews + CSV download */}
          {Object.entries(datasets).map(([name, rows]) =>
            rows.length ? (
              <div key={name} className="rounded-xl border border-outline-variant">
                <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2">
                  <span className="text-sm font-semibold text-on-surface">
                    {name} · {rows.length} row(s)
                  </span>
                  {csv[name] && (
                    <a
                      href={csv[name]}
                      download
                      className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary hover:opacity-90"
                    >
                      <Download size={14} /> CSV
                    </a>
                  )}
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container text-on-surface-variant">
                      <tr>
                        {Object.keys(rows[0]).map((h) => (
                          <th key={h} className="px-3 py-1.5 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-outline-variant">
                          {Object.keys(rows[0]).map((h) => (
                            <td key={h} className="px-3 py-1.5 text-on-surface">
                              {r[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null,
          )}

          {/* Text file outputs */}
          {Object.entries(txt).map(([name, url]) => (
            <div key={name} className="rounded-xl border border-outline-variant">
              <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2">
                <span className="text-sm font-semibold text-on-surface">{name}</span>
                <a
                  href={url}
                  download
                  className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary hover:opacity-90"
                >
                  <Download size={14} /> .txt
                </a>
              </div>
              {texts[name] !== undefined && (
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-on-surface">
                  {texts[name].slice(0, 2000) || "(empty)"}
                </pre>
              )}
            </div>
          ))}

          {/* Per-node timeline */}
          <ol className="space-y-1.5">
            {result.nodes.map((n, i) => (
              <li
                key={`${n.nodeId}-${i}`}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">
                    {n.errorType === "warning" ? (
                      <AlertTriangle className="text-amber-500" size={16} />
                    ) : n.ok ? (
                      <CheckCircle2 className="text-emerald-500" size={16} />
                    ) : (
                      <XCircle className="text-rose-500" size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-surface">
                        {n.label}
                      </span>
                      {n.iteration !== undefined && (
                        <span className="rounded bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700">
                          #{n.iteration + 1}
                        </span>
                      )}
                      {n.errorType && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            n.errorType === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {n.errorType.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    {n.message && (
                      <p
                        className={`mt-1 text-xs ${
                          n.errorType === "warning" ? "text-amber-700" : "text-rose-700"
                        }`}
                      >
                        {n.message}
                      </p>
                    )}
                    {n.detail && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-on-surface-variant">
                          Technical details
                        </summary>
                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface-container p-2 font-mono text-[11px] text-on-surface-variant">
                          {n.detail}
                        </pre>
                      </details>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-on-surface-variant">
                    {n.durationMs}ms
                  </span>
                </div>
                {n.screenshot && (
                  <a href={n.screenshot} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={n.screenshot}
                      alt={n.label}
                      className="mt-2 max-h-40 w-full rounded-md border border-outline-variant object-cover object-top"
                    />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
