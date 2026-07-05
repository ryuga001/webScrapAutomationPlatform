// Shared types for the WebBot automation task manager.

/** The set of automation actions a step can perform. */
export type StepAction =
  | "goto" // navigate to `value` (a URL)
  | "click" // click the element matching `selector`
  | "fill" // clear + type `value` into `selector`
  | "type" // type `value` into `selector` (keystroke by keystroke)
  | "press" // press key `value` (optionally focused on `selector`)
  | "waitForSelector" // wait until `selector` is visible
  | "waitForTimeout" // pause for `value` milliseconds
  | "expectText" // assert `value` text appears (in `selector`, or the page)
  | "screenshot"; // capture a screenshot

/** Actions that require a CSS/text selector. */
export const SELECTOR_ACTIONS: StepAction[] = [
  "click",
  "fill",
  "type",
  "waitForSelector",
];

/** Actions that require a value. */
export const VALUE_ACTIONS: StepAction[] = [
  "goto",
  "fill",
  "type",
  "press",
  "waitForTimeout",
  "expectText",
];

/** How an element should be located on the page. */
export type LocatorType =
  | "text" // visible text
  | "role" // ARIA role + accessible name
  | "label" // form control by its label
  | "placeholder" // input by placeholder text
  | "testid" // data-testid attribute
  | "css"; // raw CSS selector or XPath

export interface Step {
  id: string;
  action: StepAction;
  /** How to find the target element (defaults to "css" for legacy steps). */
  locatorType?: LocatorType;
  /** The query: the text / label / placeholder / test id / CSS, per locatorType. */
  selector?: string;
  /** ARIA role, used only when locatorType === "role" (e.g. "button"). */
  role?: string;
  /** Action value: URL, text to fill/expect, key to press, or ms to wait. */
  value?: string;
  /** Optional per-step timeout override in milliseconds. */
  timeoutMs?: number;
}

/** Classification of why a step failed, for clearer reporting. */
export type StepErrorType =
  | "not_found"
  | "ambiguous"
  | "timeout"
  | "navigation"
  | "assertion"
  | "invalid"
  | "error";

export interface StepResult {
  index: number;
  action: string;
  description: string;
  ok: boolean;
  /** Human-readable explanation of the failure (empty when ok). */
  message?: string;
  /** Classification of the failure, for badges/icons. */
  errorType?: StepErrorType;
  /** Raw underlying error (Playwright's message), for debugging. */
  detail?: string;
  durationMs: number;
  skipped?: boolean;
  /** URL of a screenshot captured right after this step (if enabled). */
  screenshot?: string;
}

export interface RunResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: StepResult[];
  error?: string;
}

export interface Task {
  id: string;
  name: string;
  url: string;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  lastRun?: RunResult;
}

/** The shape accepted when creating/updating a task. */
export interface TaskInput {
  name: string;
  url: string;
  steps: Step[];
}

export const LOCATOR_TYPES: {
  value: LocatorType;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    value: "text",
    label: "Text",
    hint: "Matches an element by its visible text",
    placeholder: 'e.g. Show all',
  },
  {
    value: "role",
    label: "Role + name",
    hint: "Matches by accessible role and name (most robust for buttons/links)",
    placeholder: 'Accessible name, e.g. Show all',
  },
  {
    value: "label",
    label: "Label",
    hint: "A form field by its <label> text",
    placeholder: 'e.g. Email address',
  },
  {
    value: "placeholder",
    label: "Placeholder",
    hint: "An input by its placeholder text",
    placeholder: 'e.g. Search…',
  },
  {
    value: "testid",
    label: "Test ID",
    hint: "The element's data-testid attribute",
    placeholder: 'e.g. submit-button',
  },
  {
    value: "css",
    label: "CSS / XPath",
    hint: "A raw CSS selector or XPath expression",
    placeholder: 'e.g. #submit, .btn.primary',
  },
];

/** Common ARIA roles offered when locating by role. */
export const ELEMENT_ROLES = [
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "tab",
  "menuitem",
  "option",
  "heading",
  "img",
  "switch",
  "listitem",
  "cell",
];

/** Locator types that also require a separate role selection. */
export const ROLE_LOCATOR: LocatorType = "role";

export const STEP_ACTIONS: { value: StepAction; label: string; hint: string }[] =
  [
    { value: "goto", label: "Go to URL", hint: "Navigate to a URL" },
    { value: "click", label: "Click", hint: "Click an element" },
    { value: "fill", label: "Fill", hint: "Set the value of an input" },
    { value: "type", label: "Type", hint: "Type text character by character" },
    { value: "press", label: "Press key", hint: "Press a keyboard key (e.g. Enter)" },
    {
      value: "waitForSelector",
      label: "Wait for element",
      hint: "Wait until an element is visible",
    },
    {
      value: "waitForTimeout",
      label: "Wait (ms)",
      hint: "Pause for a number of milliseconds",
    },
    {
      value: "expectText",
      label: "Expect text",
      hint: "Assert text is present (optionally within an element)",
    },
    { value: "screenshot", label: "Screenshot", hint: "Capture a screenshot" },
  ];
