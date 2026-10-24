import type { ChatRequest } from "@/lib/chat/validation";
import { buildMentalHealthSystemPrompt, containsInternalDraft, getCrisisReply, isPossibleSelfHarmCrisis } from "@/lib/server/safety";
import type { Database } from "@/lib/supabase/database.types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ConversationRow = Pick<Database["public"]["Tables"]["conversations"]["Row"], "id" | "title">;
export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ChatStore {
  getConversation(conversationId: string, userId: string): Promise<ConversationRow | null>;
  findUserMessage(userId: string, requestId: string): Promise<MessageRow | null>;
  findAssistantReply(userId: string, userMessageId: string): Promise<MessageRow | null>;
  claimTurn(conversationId: string, requestId: string): Promise<boolean>;
  releaseTurn(conversationId: string, requestId: string): Promise<void>;
  consumeRateLimit(): Promise<boolean>;
  insertUserMessage(values: { conversation_id: string; user_id: string; content: string; request_id: string }): Promise<MessageRow>;
  updateTitle(conversationId: string, userId: string, title: string): Promise<void>;
  getRecentMessages(conversationId: string, userId: string, limit: number): Promise<MessageRow[]>;
  saveAssistantReply(values: { conversationId: string; userId: string; requestId: string; content: string }): Promise<MessageRow>;
}

export type ChatResult = { status: number; body: Record<string, unknown> };
export type ChatProvider = (messages: ModelMessage[], signal?: AbortSignal) => Promise<string>;

function fallbackReply(language: ChatRequest["language"]) {
  if (language === "fr-FR") return "Je suis là avec toi. Qu'est-ce qui te serait le plus utile à partager maintenant ?";
  if (language === "ar-SA") return "أنا هنا معك. ما أكثر شيء ترغب في مشاركته الآن؟";
  return "I'm here with you. What would feel most helpful to share right now?";
}

function buildBoundedHistory(rows: MessageRow[]): ModelMessage[] {
  const mostRecent = rows.slice(-24);
  const selected: MessageRow[] = [];
  let characterBudget = 12000;
  for (let index = mostRecent.length - 1; index >= 0; index -= 1) {
    const row = mostRecent[index];
    if (row.content.length > characterBudget) continue;
    selected.push(row);
    characterBudget -= row.content.length;
  }
  return selected.reverse().map((row) => ({ role: row.role, content: row.content }));
}

function successBody(conversation: ConversationRow, userMessage: MessageRow, assistantMessage: MessageRow, safetyResponse = false) {
  return { conversation, userMessage, assistantMessage, safetyResponse };
}

export async function runChatTurn(input: ChatRequest, userId: string, store: ChatStore, provider: ChatProvider, signal?: AbortSignal): Promise<ChatResult> {
  try {
    const conversation = await store.getConversation(input.conversationId, userId);
    if (!conversation) return { status: 404, body: { error: "Conversation not found." } };

    const existingUserMessage = await store.findUserMessage(userId, input.requestId);
    if (existingUserMessage) {
      if (existingUserMessage.conversation_id !== input.conversationId || existingUserMessage.content !== input.message) {
        return { status: 409, body: { error: "This retry does not match the saved message." } };
      }
      const existingReply = await store.findAssistantReply(userId, existingUserMessage.id);
      if (existingReply) return { status: 200, body: successBody(conversation, existingUserMessage, existingReply) };
    }

    const claimed = await store.claimTurn(input.conversationId, input.requestId);
    if (!claimed) return { status: 409, body: { error: "Another reply is being prepared for this conversation. Please wait a moment." } };

    try {
      const withinLimit = await store.consumeRateLimit();
      if (!withinLimit) return { status: 429, body: { error: "You've reached the chat limit for this hour. Please try again later." } };

      const userMessage = existingUserMessage || await store.insertUserMessage({
        conversation_id: input.conversationId,
        user_id: userId,
        content: input.message,
        request_id: input.requestId,
      });
      const title = conversation.title === "New conversation"
        ? input.message.replace(/\s+/g, " ").trim().slice(0, 72) || "New conversation"
        : conversation.title;
      if (title !== conversation.title) await store.updateTitle(input.conversationId, userId, title);

      const history = await store.getRecentMessages(input.conversationId, userId, 80);
      const possibleCrisis = isPossibleSelfHarmCrisis(input.message);
      let reply = possibleCrisis ? getCrisisReply(input.language) : "";
      if (!reply) {
        const modelMessages: ModelMessage[] = [
          { role: "system", content: buildMentalHealthSystemPrompt(input.language, possibleCrisis) },
          ...buildBoundedHistory(history),
        ];
        try {
          reply = (await provider(modelMessages, signal)).trim();
        } catch {
          return { status: 502, body: { error: "Raha couldn't respond just now. Your message is saved; please retry it.", retryable: true } };
        }
        if (!reply) return { status: 502, body: { error: "Raha returned an empty reply. Your message is saved; please retry it.", retryable: true } };
        if (containsInternalDraft(reply)) reply = fallbackReply(input.language);
      }

      let assistantMessage: MessageRow;
      try {
        assistantMessage = await store.saveAssistantReply({
          conversationId: input.conversationId,
          userId,
          requestId: input.requestId,
          content: reply,
        });
      } catch {
        return { status: 503, body: { error: "The reply couldn't be saved. Retry this message to recover it safely.", retryable: true } };
      }
      const updatedConversation = { ...conversation, title };
      return { status: 200, body: successBody(updatedConversation, userMessage, assistantMessage, possibleCrisis) };
    } finally {
      await store.releaseTurn(input.conversationId, input.requestId).catch(() => undefined);
    }
  } catch {
    return { status: 503, body: { error: "Raha couldn't access this conversation right now. Please try again.", retryable: true } };
  }
}
