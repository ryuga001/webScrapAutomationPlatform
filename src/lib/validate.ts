import { randomUUID } from "node:crypto";
import type { LocatorType, Step, StepAction, TaskInput } from "./types";

const KNOWN_ACTIONS: StepAction[] = [
  "goto",
  "click",
  "fill",
  "type",
  "press",
  "waitForSelector",
  "waitForTimeout",
  "expectText",
  "screenshot",
];

const KNOWN_LOCATORS: LocatorType[] = [
  "text",
  "role",
  "label",
  "placeholder",
  "testid",
  "css",
];

export class ValidationError extends Error {}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Validate and normalize an untrusted request body into a TaskInput. */
export function parseTaskInput(body: unknown): TaskInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object");
  }
  const b = body as Record<string, unknown>;

  const name = asString(b.name);
  if (!name) throw new ValidationError("Task name is required");

  const url = asString(b.url);
  if (!url) throw new ValidationError("Task URL is required");
  try {
    new URL(url);
  } catch {
    throw new ValidationError("Task URL must be a valid absolute URL");
  }

  const steps = parseSteps(b.steps);
  return { name, url, steps };
}

export function parseSteps(raw: unknown): Step[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError("steps must be an array");

  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new ValidationError(`Step ${i + 1} is invalid`);
    }
    const s = item as Record<string, unknown>;
    const action = asString(s.action) as StepAction;
    if (!KNOWN_ACTIONS.includes(action)) {
      throw new ValidationError(`Step ${i + 1} has an unknown action`);
    }
    const step: Step = {
      id: asString(s.id) || randomUUID(),
      action,
    };
    const selector = asString(s.selector);
    const value = asString(s.value);
    const role = asString(s.role);
    const locatorType = asString(s.locatorType) as LocatorType;
    if (selector) step.selector = selector;
    if (value) step.value = value;
    if (role) step.role = role;
    if (KNOWN_LOCATORS.includes(locatorType)) step.locatorType = locatorType;
    if (typeof s.timeoutMs === "number" && Number.isFinite(s.timeoutMs)) {
      step.timeoutMs = Math.min(Math.max(Math.round(s.timeoutMs), 1000), 120_000);
    }
    return step;
  });
}
