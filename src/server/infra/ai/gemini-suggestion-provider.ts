import type { IAiSuggestionProvider } from "@/server/domain/ai";
import { UpstreamError } from "@/server/domain/errors";
import {
  CHAT_LIMITS,
  getTone,
  type ChatSuggestInput,
  type Suggestion,
} from "@/lib/chat-suggest";

// True when the reply language differs from English (so we also want a gloss).
function wantsTranslation(input: ChatSuggestInput): boolean {
  const l = (input.language ?? "auto").toLowerCase();
  return l !== "auto" && l !== "english";
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Calls the Google Gemini REST API. Kept behind IAiSuggestionProvider so the
// rest of the app never knows the transport. First server-side outbound fetch
// in the repo — no SDK dependency, just the global `fetch` (Node runtime).
export class GeminiSuggestionProvider implements IAiSuggestionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async suggest(input: ChatSuggestInput): Promise<Suggestion[]> {
    if (!this.apiKey) throw new UpstreamError("AI is not configured");

    const count = input.count ?? CHAT_LIMITS.defaultCount;
    const body = {
      systemInstruction: { parts: [{ text: this.buildSystemPrompt(input, count) }] },
      contents: [{ role: "user", parts: [{ text: this.buildTranscript(input) }] }],
      generationConfig: {
        // Higher randomness when the user asks to "vary" the options.
        temperature: input.creative ? 1.15 : 0.8,
        responseMimeType: "application/json",
      },
    };

    let res: Response;
    try {
      res = await fetch(
        `${ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    } catch (err) {
      console.error("[gemini] request failed:", err);
      throw new UpstreamError("Could not reach the AI service");
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[gemini] ${res.status} for model "${this.model}":`, detail);
      throw new UpstreamError(`AI service error (${res.status})`);
    }

    const data = await res.json().catch(() => null);
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new UpstreamError("AI returned an empty response");

    return this.parseSuggestions(text, count);
  }

  private buildSystemPrompt(input: ChatSuggestInput, count: number): string {
    const lines = [
      `You suggest replies for the person labelled "me" in a chat conversation.`,
      `Return ${count} distinct reply option${count === 1 ? "" : "s"}, ready to send as-is.`,
      `Write only the reply text — no quotes, numbering, preamble or explanation.`,
    ];
    // A user-supplied detailed system prompt takes top priority.
    if (input.systemPrompt) lines.push(`Follow these instructions closely: ${input.systemPrompt}`);
    if (input.intent) lines.push(`The goal of this conversation is: ${input.intent}. Steer every reply toward advancing it.`);
    const tone = getTone(input.tone);
    if (tone?.prompt) lines.push(tone.prompt);
    if (input.persona) lines.push(`Write as: ${input.persona}.`);
    if (input.instruction) lines.push(`Follow this instruction for the reply: ${input.instruction}.`);
    if (input.language && input.language !== "auto")
      lines.push(`Write the reply in ${input.language}.`);
    else lines.push(`Reply in the same language as the conversation.`);
    if (input.creative)
      lines.push(`Make the options varied and creative — avoid repeating similar phrasings.`);
    if (input.draft) lines.push(`Build on this draft the user started: "${input.draft}".`);
    if (wantsTranslation(input)) {
      lines.push(
        `Respond as a JSON array of objects, each with "reply" (the reply in ${input.language}) ` +
          `and "translation" (a faithful English translation of that reply).`,
      );
    } else {
      lines.push(`Respond as a JSON array of strings.`);
    }
    return lines.join(" ");
  }

  private buildTranscript(input: ChatSuggestInput): string {
    const convo = input.messages
      .map((m) => `${m.author === "me" ? "Me" : "Them"}: ${m.text}`)
      .join("\n");
    return `Conversation so far:\n${convo}\n\nSuggest my next reply.`;
  }

  private parseSuggestions(text: string, count: number): Suggestion[] {
    // Preferred path: the model returns a JSON array (responseMimeType).
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        // Only accept string fields — never String(obj), which yields "[object Object]".
        const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        const out = parsed
          .map((item) => {
            if (item && typeof item === "object") {
              const t = str(item.reply) || str(item.text);
              const tr = str(item.translation) || str(item.english);
              return t ? { text: t, ...(tr ? { translation: tr } : {}) } : null;
            }
            const s = str(item);
            return s ? { text: s } : null;
          })
          .filter((s): s is Suggestion => s !== null)
          .slice(0, count);
        if (out.length) return out;
      }
    } catch {
      // fall through to line splitting
    }
    // Fallback: split lines, strip common list/quote decoration (no translation).
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[\s\-*0-9.)"]+/, "").replace(/"$/, "").trim())
      .filter(Boolean);
    if (!lines.length) throw new UpstreamError("AI returned no usable suggestions");
    return lines.slice(0, count).map((text) => ({ text }));
  }
}
