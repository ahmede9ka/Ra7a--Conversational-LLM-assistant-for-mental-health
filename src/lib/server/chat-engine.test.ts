import { beforeEach, describe, expect, it, vi } from "vitest";
import { runChatTurn, type ChatProvider, type ChatStore } from "@/lib/server/chat-engine";
import type { Database } from "@/lib/supabase/database.types";
import type { ChatRequest } from "@/lib/chat/validation";
import { ProviderError } from "@/lib/llm/types";

type Message = Database["public"]["Tables"]["messages"]["Row"];
const userId = "00000000-0000-0000-0000-000000000101";
const conversationId = "00000000-0000-0000-0000-000000000201";
const requestId = "00000000-0000-0000-0000-000000000301";
const conversation = { id: conversationId, title: "New conversation" };

class FakeStore implements ChatStore {
  messages: Message[] = [];
  conversationExists = true;
  allowed = true;
  claimed = true;
  failAssistantSave = false;
  rateChecks = 0;
  claims = 0;
  releases = 0;
  titles: string[] = [];
  constructor() {
    this.messages = [{ id: "00000000-0000-0000-0000-000000000401", conversation_id: conversationId, user_id: userId, role: "user", content: "I feel overwhelmed.", request_id: "00000000-0000-0000-0000-000000000402", reply_to: null, created_at: "2026-01-01T00:00:00.000Z" }];
  }
  async getConversation(id: string, ownerId: string) { return this.conversationExists && id === conversationId && ownerId === userId ? conversation : null; }
  async findUserMessage(ownerId: string, id: string) { return this.messages.find((m) => m.user_id === ownerId && m.role === "user" && m.request_id === id) || null; }
  async findAssistantReply(ownerId: string, userMessageId: string) { return this.messages.find((m) => m.user_id === ownerId && m.role === "assistant" && m.reply_to === userMessageId) || null; }
  async claimTurn() { this.claims += 1; return this.claimed; }
  async releaseTurn() { this.releases += 1; }
  async consumeRateLimit() { this.rateChecks += 1; return this.allowed; }
  async insertUserMessage(values: { conversation_id: string; user_id: string; content: string; request_id: string }) {
    const row: Message = { id: "00000000-0000-0000-0000-000000000501", ...values, role: "user", request_id: values.request_id, reply_to: null, created_at: new Date().toISOString() };
    this.messages.push(row);
    return row;
  }
  async updateTitle(_id: string, _ownerId: string, title: string) { this.titles.push(title); }
  async getRecentMessages(id: string, ownerId: string) { return this.messages.filter((m) => m.conversation_id === id && m.user_id === ownerId); }
  async saveAssistantReply(values: { conversationId: string; userId: string; requestId: string; content: string }) {
    if (this.failAssistantSave) throw new Error("Database unavailable");
    const userMessage = this.messages.find((m) => m.request_id === values.requestId && m.role === "user");
    if (!userMessage) throw new Error("Missing user message");
    const row: Message = { id: "00000000-0000-0000-0000-000000000601", conversation_id: values.conversationId, user_id: values.userId, role: "assistant", content: values.content, request_id: null, reply_to: userMessage.id, created_at: new Date().toISOString() };
    this.messages.push(row);
    return row;
  }
}

const input: ChatRequest = { conversationId, requestId, message: "I feel overwhelmed today.", language: "en-GB" };

describe("runChatTurn", () => {
  let store: FakeStore;
  let provider: ReturnType<typeof vi.fn<ChatProvider>>;
  beforeEach(() => {
    store = new FakeStore();
    provider = vi.fn<ChatProvider>().mockResolvedValue("That sounds like a lot to carry. What feels hardest right now?");
  });

  it("rejects a conversation the authenticated user does not own", async () => {
    store.conversationExists = false;
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });

  it("loads trusted conversation history, saves a user turn and reply, and releases the lock", async () => {
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(200);
    expect(provider.mock.calls[0][0].map((message) => message.role)).toEqual(["system", "user", "user"]);
    expect(provider.mock.calls[0][0].some((message) => message.content === input.message)).toBe(true);
    expect(store.messages).toHaveLength(3);
    expect(store.titles[0]).toBe(input.message);
    expect(store.releases).toBe(1);
    expect(result.body.safetyResponse).toBe(false);
  });

  it("returns an existing saved reply for an idempotent retry without another provider call", async () => {
    const first = await runChatTurn(input, userId, store, provider);
    const second = await runChatTurn(input, userId, store, provider);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(store.messages).toHaveLength(3);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("does not call the model for detected self-harm risk and returns a localized safety response", async () => {
    const crisisInput = { ...input, message: "I want to kill myself", language: "fr-FR" as const };
    const result = await runChatTurn(crisisInput, userId, store, provider);
    expect(result.status).toBe(200);
    expect(result.body.safetyResponse).toBe(true);
    expect(provider).not.toHaveBeenCalled();
    expect(store.messages.at(-1)?.content).toContain("services d'urgence");
  });

  it("leaves a retryable user message, never an invented assistant reply, when the provider fails", async () => {
    provider.mockRejectedValue(new Error("Provider timeout"));
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(502);
    expect(result.body.retryable).toBe(true);
    expect(store.messages).toHaveLength(2);
    expect(store.messages.some((message) => message.role === "assistant")).toBe(false);
    expect(store.releases).toBe(1);
  });

  it("reports a selected provider configuration problem without switching providers", async () => {
    provider.mockRejectedValue(new ProviderError("Missing key", "configuration"));
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(503);
    expect(result.body.error).toContain("selected reply provider is not configured");
    expect(store.messages.some((message) => message.role === "assistant")).toBe(false);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("returns a recoverable error if the model reply cannot be persisted", async () => {
    store.failAssistantSave = true;
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(503);
    expect(result.body.retryable).toBe(true);
    expect(store.messages).toHaveLength(2);
  });

  it("enforces the per-user rate limit before saving a new message", async () => {
    store.allowed = false;
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(429);
    expect(store.messages).toHaveLength(1);
    expect(provider).not.toHaveBeenCalled();
    expect(store.releases).toBe(1);
  });

  it("rejects concurrent turns for the same conversation", async () => {
    store.claimed = false;
    const result = await runChatTurn(input, userId, store, provider);
    expect(result.status).toBe(409);
    expect(provider).not.toHaveBeenCalled();
    expect(store.rateChecks).toBe(0);
  });
});
