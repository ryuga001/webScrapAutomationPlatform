// Shared types + tone presets for the Chat Assist feature. Kept in `src/lib`
// (framework-agnostic, no server imports) so both the API validator/prompt
// builder and the browser extension can share one source of truth.

export type ChatAuthor = "me" | "them";

export interface ChatMessage {
  author: ChatAuthor;
  text: string;
}

export type ToneId =
  | "friendly"
  | "professional"
  | "concise"
  | "warm"
  | "witty"
  | "custom";

export interface Tone {
  id: ToneId;
  label: string;
  /** Instruction fragment appended to the system prompt. */
  prompt: string;
}

// Ordered for display in the extension's tone selector.
export const TONES: Tone[] = [
  { id: "friendly", label: "Friendly", prompt: "Keep it friendly and approachable." },
  { id: "professional", label: "Professional", prompt: "Keep it professional and polished." },
  { id: "concise", label: "Concise", prompt: "Be brief — one or two short sentences at most." },
  { id: "warm", label: "Warm", prompt: "Be warm, empathetic and personable." },
  { id: "witty", label: "Witty", prompt: "Add a light, playful, witty touch without overdoing it." },
  { id: "custom", label: "Custom", prompt: "" },
];

export const TONE_IDS: ToneId[] = TONES.map((t) => t.id);

export function getTone(id: string | undefined): Tone | undefined {
  return TONES.find((t) => t.id === id);
}

// Reply languages offered in the extension. "auto" mirrors the conversation.
export interface Language {
  id: string;
  label: string;
}
export const LANGUAGES: Language[] = [
  { id: "auto", label: "Auto (match chat)" },
  { id: "English", label: "English" },
  { id: "Spanish", label: "Spanish" },
  { id: "French", label: "French" },
  { id: "German", label: "German" },
  { id: "Portuguese", label: "Portuguese" },
  { id: "Italian", label: "Italian" },
  { id: "Hindi", label: "Hindi" },
  { id: "Arabic", label: "Arabic" },
  { id: "Japanese", label: "Japanese" },
  { id: "Chinese", label: "Chinese" },
];

/** One reply suggestion; `translation` is set (English) when replying in another language. */
export interface Suggestion {
  text: string;
  translation?: string;
}

export interface ChatSuggestInput {
  messages: ChatMessage[];
  tone?: ToneId;
  /** Free-text description of the voice to write in (the "actor"). */
  persona?: string;
  /** A one-off directive for this reply, e.g. "politely decline". */
  instruction?: string;
  /** The goal of the conversation, e.g. "book a demo". */
  intent?: string;
  /** A detailed custom system prompt (advanced) that overrides the defaults. */
  systemPrompt?: string;
  /** Language to reply in; "auto"/undefined mirrors the conversation. */
  language?: string;
  /** A partial reply the user has already started. */
  draft?: string;
  /** Ask for more varied / higher-randomness options. */
  creative?: boolean;
  /** Number of suggestions to return (1–5). */
  count?: number;
}

/** Limits shared by the validator and clients. */
export const CHAT_LIMITS = {
  maxMessages: 40,
  maxTotalChars: 12_000,
  maxPersonaChars: 300,
  maxInstructionChars: 300,
  maxIntentChars: 200,
  maxSystemPromptChars: 2_000,
  maxLanguageChars: 40,
  minCount: 1,
  maxCount: 5,
  defaultCount: 3,
} as const;
