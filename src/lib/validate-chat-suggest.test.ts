import { describe, it, expect } from "vitest";
import { parseChatSuggestInput, ValidationError } from "./validate-chat-suggest";
import { CHAT_LIMITS } from "./chat-suggest";

const base = {
  messages: [{ author: "them", text: "are we still on for friday?" }],
};

describe("parseChatSuggestInput", () => {
  it("accepts a valid body and defaults count", () => {
    const out = parseChatSuggestInput(base);
    expect(out.messages).toHaveLength(1);
    expect(out.count).toBe(CHAT_LIMITS.defaultCount);
  });

  it("rejects a non-object body", () => {
    expect(() => parseChatSuggestInput(null)).toThrow(ValidationError);
    expect(() => parseChatSuggestInput("nope")).toThrow(ValidationError);
  });

  it("requires a non-empty messages array", () => {
    expect(() => parseChatSuggestInput({ messages: [] })).toThrow(ValidationError);
    expect(() => parseChatSuggestInput({})).toThrow(ValidationError);
  });

  it("rejects an invalid author", () => {
    expect(() =>
      parseChatSuggestInput({ messages: [{ author: "bot", text: "hi" }] }),
    ).toThrow(ValidationError);
  });

  it("rejects empty message text", () => {
    expect(() =>
      parseChatSuggestInput({ messages: [{ author: "me", text: "   " }] }),
    ).toThrow(ValidationError);
  });

  it("rejects an unknown tone but accepts a known one", () => {
    expect(() => parseChatSuggestInput({ ...base, tone: "sarcastic" })).toThrow(
      ValidationError,
    );
    expect(parseChatSuggestInput({ ...base, tone: "concise" }).tone).toBe("concise");
  });

  it("clamps count to the allowed range", () => {
    expect(parseChatSuggestInput({ ...base, count: 99 }).count).toBe(CHAT_LIMITS.maxCount);
    expect(parseChatSuggestInput({ ...base, count: 0 }).count).toBe(CHAT_LIMITS.minCount);
  });

  it("caps persona length", () => {
    const persona = "x".repeat(500);
    expect(parseChatSuggestInput({ ...base, persona }).persona).toHaveLength(
      CHAT_LIMITS.maxPersonaChars,
    );
  });

  it("rejects too many messages", () => {
    const messages = Array.from({ length: CHAT_LIMITS.maxMessages + 1 }, () => ({
      author: "them",
      text: "hi",
    }));
    expect(() => parseChatSuggestInput({ messages })).toThrow(ValidationError);
  });
});
