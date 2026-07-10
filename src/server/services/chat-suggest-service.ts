import type { IAiSuggestionProvider } from "@/server/domain/ai";
import type { IRateLimiter } from "@/server/domain/rate-limit";
import type { Suggestion } from "@/lib/chat-suggest";
import { parseChatSuggestInput } from "@/lib/validate-chat-suggest";

// Generates AI reply suggestions for a conversation. Rate-limited per user and
// provider-agnostic (depends on IAiSuggestionProvider, not Gemini directly).
export class ChatSuggestService {
  constructor(
    private readonly provider: IAiSuggestionProvider,
    private readonly limiter: IRateLimiter,
  ) {}

  async suggest(userId: string, body: unknown): Promise<Suggestion[]> {
    this.limiter.check(userId);
    const input = parseChatSuggestInput(body);
    return this.provider.suggest(input);
  }
}
