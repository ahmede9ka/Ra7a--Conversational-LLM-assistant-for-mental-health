import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultProvider, getProvider, ollamaProvider, openRouterProvider } from "@/lib/llm/providers";
import { ProviderError, parseProviderId } from "@/lib/llm/types";

const messages = [{ role: "system" as const, content: "Be supportive." }, { role: "user" as const, content: "Hi." }];
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("LLM providers", () => {
  it("uses a validated deployment default without inferring it from credentials", () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(getDefaultProvider()).toBe("openrouter");
    expect(getProvider("ollama")).toBe(ollamaProvider);
    expect(getProvider("openrouter")).toBe(openRouterProvider);
  });

  it("rejects unsupported providers", () => {
    expect(() => parseProviderId("custom-url")).toThrow(ProviderError);
  });

  it("constructs a bounded non-streaming Ollama chat request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: "Hello." } }), { status: 200 }));
    globalThis.fetch = fetchMock;
    expect(await ollamaProvider(messages)).toBe("Hello.");
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:11434/api/chat");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ model: "qwen3:8b", stream: false, messages });
    expect(body.options.num_predict).toBe(512);
  });

  it("constructs an authenticated OpenRouter request using only server configuration", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-server-key");
    vi.stubEnv("OPENROUTER_MODEL", "sample/model");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Hello." } }] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    expect(await openRouterProvider(messages)).toBe("Hello.");
    expect(fetchMock.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-server-key");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("sample/model");
  });

  it("reports missing credentials without falling back", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    await expect(openRouterProvider(messages)).rejects.toMatchObject({ kind: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes upstream, empty, and network failures", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(ollamaProvider(messages)).rejects.toMatchObject({ kind: "upstream" });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: " " } }), { status: 200 }));
    await expect(ollamaProvider(messages)).rejects.toMatchObject({ kind: "invalid_response" });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(ollamaProvider(messages)).rejects.toMatchObject({ kind: "network" });
  });

  it("normalizes a request timeout", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch;
    vi.stubEnv("OLLAMA_TIMEOUT_MS", "1000");
    const pending = ollamaProvider(messages);
    const rejected = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
  });
});
