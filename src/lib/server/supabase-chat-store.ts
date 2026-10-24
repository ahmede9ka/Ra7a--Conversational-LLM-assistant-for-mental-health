import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatStore } from "@/lib/server/chat-engine";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export function createSupabaseChatStore(userClient: Client, adminClient: Client): ChatStore {
  return {
    async getConversation(conversationId, userId) {
      const { data, error } = await userClient.from("conversations").select("id,title").eq("id", conversationId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async findUserMessage(userId, requestId) {
      const { data, error } = await userClient.from("messages").select("*").eq("user_id", userId).eq("request_id", requestId).eq("role", "user").maybeSingle();
      if (error) throw error;
      return data;
    },
    async findAssistantReply(userId, userMessageId) {
      const { data, error } = await userClient.from("messages").select("*").eq("user_id", userId).eq("reply_to", userMessageId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async claimTurn(conversationId, requestId) {
      const { data, error } = await userClient.rpc("claim_conversation_turn", { p_conversation_id: conversationId, p_request_id: requestId });
      if (error) throw error;
      return data;
    },
    async releaseTurn(conversationId, requestId) {
      const { error } = await userClient.rpc("release_conversation_turn", { p_conversation_id: conversationId, p_request_id: requestId });
      if (error) throw error;
    },
    async consumeRateLimit() {
      const { data, error } = await userClient.rpc("consume_chat_rate_limit");
      if (error) throw error;
      return data;
    },
    async insertUserMessage(values) {
      const { data, error } = await userClient.from("messages").insert({ ...values, role: "user", reply_to: null }).select("*").single();
      if (error) throw error;
      return data;
    },
    async updateTitle(conversationId, userId, title) {
      const { error } = await userClient.from("conversations").update({ title }).eq("id", conversationId).eq("user_id", userId);
      if (error) throw error;
    },
    async getRecentMessages(conversationId, userId, limit) {
      const { data, error } = await userClient.from("messages").select("*").eq("conversation_id", conversationId).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data.reverse();
    },
    async saveAssistantReply(values) {
      const { data: messageId, error: persistError } = await adminClient.rpc("persist_assistant_reply", {
        p_conversation_id: values.conversationId,
        p_user_id: values.userId,
        p_request_id: values.requestId,
        p_content: values.content,
      });
      if (persistError || !messageId) throw persistError || new Error("Assistant reply could not be persisted.");
      const { data, error } = await userClient.from("messages").select("*").eq("id", messageId).eq("user_id", values.userId).single();
      if (error) throw error;
      return data;
    },
  };
}
