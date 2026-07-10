import { describe, it, expect } from "vitest";
import { ChatSuggestService } from "./chat-suggest-service";
import { RateLimitError, ValidationError } from "@/server/domain/errors";
import { InMemoryRateLimiter } from "@/server/infra/rate-limit/in-memory-rate-limiter";
import { FakeAiProvider } from "@/server/testing/fakes";

const USER = "user_1";
const body = {
  messages: [{ author: "them", text: "lunch tomorrow?" }],
  tone: "concise",
  persona: "a busy founder",
  instruction: "politely decline",
  language: "Spanish",
};

function makeService(limit = 100) {
  const provider = new FakeAiProvider(["Yes — noon works.", "Can we do 1pm?"]);
  const limiter = new InMemoryRateLimiter(limit, 60_000);
  return { provider, service: new ChatSuggestService(provider, limiter) };
}

describe("ChatSuggestService", () => {
  it("returns provider suggestions for a valid body", async () => {
    const { service } = makeService();
    const out = await service.suggest(USER, body);
    expect(out).toEqual([{ text: "Yes — noon works." }, { text: "Can we do 1pm?" }]);
  });

  it("passes tone, persona, instruction and language through to the provider", async () => {
    const { provider, service } = makeService();
    await service.suggest(USER, body);
    expect(provider.lastInput?.tone).toBe("concise");
    expect(provider.lastInput?.persona).toBe("a busy founder");
    expect(provider.lastInput?.instruction).toBe("politely decline");
    expect(provider.lastInput?.language).toBe("Spanish");
  });

  it("validates the body before calling the provider", async () => {
    const { service } = makeService();
    await expect(service.suggest(USER, { messages: [] })).rejects.toThrow(
      ValidationError,
    );
  });

  it("trips the rate limiter after the quota", async () => {
    const { service } = makeService(2);
    await service.suggest(USER, body);
    await service.suggest(USER, body);
    await expect(service.suggest(USER, body)).rejects.toThrow(RateLimitError);
  });

  it("rate-limits per user independently", async () => {
    const { service } = makeService(1);
    await service.suggest(USER, body);
    await expect(service.suggest("user_2", body)).resolves.toBeTruthy();
  });
});
