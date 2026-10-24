import { parseProviderId, ProviderError, type LLMMessage, type LLMProvider, type ProviderId } from "@/lib/llm/types";

const MAX_OUTPUT_TOKENS = 512;

async function requestJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new ProviderError(`Provider returned HTTP ${response.status}.`, "upstream");
    const result: unknown = await response.json().catch(() => null);
    if (!result || typeof result !== "object") throw new ProviderError("Provider response was invalid.", "invalid_response");
    return result;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted) throw new ProviderError("Provider request timed out or was cancelled.", "timeout");
    throw new ProviderError("Provider could not be reached.", "network");
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}

function getText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new ProviderError("Provider returned an empty reply.", "invalid_response");
  return value.trim().slice(0, 4000);
}

export async function ollamaProvider(messages: LLMMessage[], signal?: AbortSignal): Promise<string> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "qwen3:8b";
  const timeout = Number(process.env.OLLAMA_TIMEOUT_MS || 60_000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120_000) throw new ProviderError("OLLAMA_TIMEOUT_MS must be between 1000 and 120000.", "configuration");
  const result = await requestJson(`${baseUrl}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.55, num_predict: MAX_OUTPUT_TOKENS } }), signal,
  }, timeout) as { message?: { content?: unknown } };
  return getText(result.message?.content);
}

export async function openRouterProvider(messages: LLMMessage[], signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new ProviderError("OPENROUTER_API_KEY is required for OpenRouter.", "configuration");
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const timeout = Number(process.env.OPENROUTER_TIMEOUT_MS || 25_000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120_000) throw new ProviderError("OPENROUTER_TIMEOUT_MS must be between 1000 and 120000.", "configuration");
  const result = await requestJson("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.55, max_tokens: MAX_OUTPUT_TOKENS }), signal,
  }, timeout) as { choices?: Array<{ message?: { content?: unknown } }> };
  return getText(result.choices?.[0]?.message?.content);
}

export function getProvider(provider: ProviderId): LLMProvider {
  return provider === "ollama" ? ollamaProvider : openRouterProvider;
}

export function getDefaultProvider(): ProviderId {
  return parseProviderId(process.env.LLM_PROVIDER);
}
