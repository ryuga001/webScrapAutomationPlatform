// Abstraction for the AI suggestion provider the chat-assist service depends on.
// Depending on this interface (not a concrete Gemini/OpenAI client) keeps the
// service testable and lets us swap providers without touching it — DIP.

import type { ChatSuggestInput, Suggestion } from "@/lib/chat-suggest";

export interface IAiSuggestionProvider {
  /** Produce reply suggestions for a conversation. Throws UpstreamError on failure. */
  suggest(input: ChatSuggestInput): Promise<Suggestion[]>;
}
