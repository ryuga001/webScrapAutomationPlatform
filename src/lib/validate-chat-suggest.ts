import { ValidationError } from "@/server/domain/errors";
import {
  CHAT_LIMITS,
  TONE_IDS,
  type ChatMessage,
  type ChatSuggestInput,
  type ToneId,
} from "./chat-suggest";

export { ValidationError };

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new ValidationError("messages must be a non-empty array");
  if (raw.length > CHAT_LIMITS.maxMessages)
    throw new ValidationError(`Too many messages (max ${CHAT_LIMITS.maxMessages})`);

  let total = 0;
  const messages = raw.map((item, i) => {
    if (typeof item !== "object" || item === null)
      throw new ValidationError(`Message ${i + 1} is invalid`);
    const m = item as Record<string, unknown>;
    const author = m.author;
    if (author !== "me" && author !== "them")
      throw new ValidationError(`Message ${i + 1} has an invalid author`);
    const text = asString(m.text);
    if (!text) throw new ValidationError(`Message ${i + 1} has empty text`);
    total += text.length;
    return { author, text } satisfies ChatMessage;
  });

  if (total > CHAT_LIMITS.maxTotalChars)
    throw new ValidationError("Conversation is too long to process");
  return messages;
}

export function parseChatSuggestInput(body: unknown): ChatSuggestInput {
  if (typeof body !== "object" || body === null)
    throw new ValidationError("Request body must be an object");
  const b = body as Record<string, unknown>;

  const messages = parseMessages(b.messages);

  let tone: ToneId | undefined;
  if (b.tone != null) {
    const t = asString(b.tone);
    if (!TONE_IDS.includes(t as ToneId))
      throw new ValidationError(`Unknown tone "${t}"`);
    tone = t as ToneId;
  }

  const persona = asString(b.persona).slice(0, CHAT_LIMITS.maxPersonaChars) || undefined;
  const instruction =
    asString(b.instruction).slice(0, CHAT_LIMITS.maxInstructionChars) || undefined;
  const intent = asString(b.intent).slice(0, CHAT_LIMITS.maxIntentChars) || undefined;
  const systemPrompt =
    asString(b.systemPrompt).slice(0, CHAT_LIMITS.maxSystemPromptChars) || undefined;
  const language = asString(b.language).slice(0, CHAT_LIMITS.maxLanguageChars) || undefined;
  const draft = asString(b.draft) || undefined;
  const creative = b.creative === true;

  const rawCount = Number(b.count);
  const count = Number.isFinite(rawCount)
    ? Math.min(CHAT_LIMITS.maxCount, Math.max(CHAT_LIMITS.minCount, Math.trunc(rawCount)))
    : CHAT_LIMITS.defaultCount;

  return {
    messages,
    tone,
    persona,
    instruction,
    intent,
    systemPrompt,
    language,
    draft,
    creative,
    count,
  };
}
