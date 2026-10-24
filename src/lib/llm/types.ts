export type ProviderId = "ollama" | "openrouter";
export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };
export type LLMProvider = (messages: LLMMessage[], signal?: AbortSignal) => Promise<string>;

export class ProviderError extends Error {
  constructor(message: string, readonly kind: "configuration" | "timeout" | "network" | "upstream" | "invalid_response") {
    super(message);
    this.name = "ProviderError";
  }
}

export function parseProviderId(value: string | undefined): ProviderId {
  if (value === undefined || value === "") return "ollama";
  if (value === "ollama" || value === "openrouter") return value;
  throw new ProviderError("LLM_PROVIDER must be ollama or openrouter.", "configuration");
}
