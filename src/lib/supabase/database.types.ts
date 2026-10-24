export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string | null; created_at?: string; updated_at?: string };
        Update: { display_name?: string | null; updated_at?: string };
        Relationships: [];
      };
      conversations: {
        Row: { id: string; user_id: string; title: string; created_at: string; updated_at: string; active_request_id: string | null; active_request_at: string | null };
        Insert: { id?: string; user_id: string; title?: string; created_at?: string; updated_at?: string; active_request_id?: string | null; active_request_at?: string | null };
        Update: { title?: string; updated_at?: string };
        Relationships: [];
      };
      messages: {
        Row: { id: string; conversation_id: string; user_id: string; role: "user" | "assistant"; content: string; request_id: string | null; reply_to: string | null; created_at: string };
        Insert: { id?: string; conversation_id: string; user_id: string; role: "user" | "assistant"; content: string; request_id?: string | null; reply_to?: string | null; created_at?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_conversation_turn: { Args: { p_conversation_id: string; p_request_id: string }; Returns: boolean };
      release_conversation_turn: { Args: { p_conversation_id: string; p_request_id: string }; Returns: undefined };
      consume_chat_rate_limit: { Args: Record<string, never>; Returns: boolean };
      persist_assistant_reply: { Args: { p_conversation_id: string; p_user_id: string; p_request_id: string; p_content: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
