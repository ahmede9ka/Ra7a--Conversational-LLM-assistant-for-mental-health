import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/chat/validation";
import { runChatTurn, type ChatProvider, type ModelMessage } from "@/lib/server/chat-engine";
import { createSupabaseChatStore } from "@/lib/server/supabase-chat-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseSecretKey } from "@/lib/supabase/env";

export const runtime = "nodejs";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const openRouterProvider: ChatProvider = async (messages: ModelMessage[], signal?: AbortSignal) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Chat provider is not configured.");
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages,
      temperature: 0.55,
      max_tokens: 512,
    }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    console.warn("[chat] Provider returned HTTP", response.status);
    throw new Error("Provider request failed.");
  }
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object") throw new Error("Provider response was invalid.");
  const choices = (result as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Provider response contained no text.");
  return content;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Raha's reply service is not configured yet." }, { status: 503 });
  if (!getSupabaseSecretKey()) return NextResponse.json({ error: "Raha's database service is not configured yet." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please send a valid chat request." }, { status: 400 }); }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your message and conversation, then try again." }, { status: 400 });

  let auth;
  try { auth = await getAuthenticatedUser(); } catch { auth = null; }
  if (!auth) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  let store;
  try {
    store = createSupabaseChatStore(auth.supabase, createSupabaseAdminClient());
  } catch {
    return NextResponse.json({ error: "Raha's database service is not configured yet." }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const abortRequest = () => controller.abort();
  request.signal.addEventListener("abort", abortRequest, { once: true });
  try {
    const result = await runChatTurn(parsed.data, auth.user.id, store, openRouterProvider, controller.signal);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortRequest);
  }
}
