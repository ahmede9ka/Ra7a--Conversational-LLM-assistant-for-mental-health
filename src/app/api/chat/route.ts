import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/chat/validation";
import { runChatTurn } from "@/lib/server/chat-engine";
import { createSupabaseChatStore } from "@/lib/server/supabase-chat-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseSecretKey } from "@/lib/supabase/env";
import { getDefaultProvider, getProvider } from "@/lib/llm/providers";
import { ProviderError } from "@/lib/llm/types";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 16_000;

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) return NextResponse.json({ error: "That message is too large. Please shorten it and try again." }, { status: 413 });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return NextResponse.json({ error: "Please send a JSON chat request." }, { status: 415 });
  if (!getSupabaseSecretKey()) return NextResponse.json({ error: "Ra7a's database service is not configured yet." }, { status: 503 });
  let body: unknown;
  try { body = await readBoundedJson(request); }
  catch (error) {
    if (error instanceof Error && error.message === "too_large") return NextResponse.json({ error: "That message is too large. Please shorten it and try again." }, { status: 413 });
    return NextResponse.json({ error: "Please send a valid chat request." }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your message and conversation, then try again." }, { status: 400 });

  let auth;
  try { auth = await getAuthenticatedUser(); } catch { auth = null; }
  if (!auth) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  let defaultProvider;
  try { defaultProvider = getDefaultProvider(); } catch (error) {
    console.error("[chat] Invalid provider configuration", error instanceof ProviderError ? error.kind : "configuration");
    return NextResponse.json({ error: "Ra7a's reply provider is not configured correctly." }, { status: 503 });
  }

  let store;
  try { store = createSupabaseChatStore(auth.supabase, createSupabaseAdminClient()); }
  catch { return NextResponse.json({ error: "Ra7a's database service is not configured yet." }, { status: 503 }); }

  // Auth metadata comes from the verified Supabase user; accept only supported provider identifiers.
  const savedPreference = auth.user.user_metadata?.raha_provider_preference;
  const providerId = savedPreference === "ollama" || savedPreference === "openrouter" ? savedPreference : defaultProvider;
  const timeoutMs = providerId === "ollama" ? Number(process.env.OLLAMA_TIMEOUT_MS || 60_000) : Number(process.env.OPENROUTER_TIMEOUT_MS || 25_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1000), 120_000));
  const abortRequest = () => controller.abort();
  request.signal.addEventListener("abort", abortRequest, { once: true });
  try {
    const result = await runChatTurn(parsed.data, auth.user.id, store, getProvider(providerId), controller.signal);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortRequest);
  }
}
