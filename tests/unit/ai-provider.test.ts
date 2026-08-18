import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderNotConfiguredError, MockAIProvider, NotConfiguredAIProvider, OpenAICompatibleProvider } from "@/src/lib/ai/provider";

describe("AI provider adapters", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns deterministic normalized mock embeddings", async () => {
    const vector = await new MockAIProvider().embed("profile");
    expect(vector).toHaveLength(1536);
    expect(Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1);
    await expect(new MockAIProvider().generateStructured("", { mock: { ok: true } })).resolves.toEqual({ ok: true });
    await expect(new MockAIProvider().generateStructured("", {})).rejects.toThrow(/explicit schema mock/i);
  });

  it("fails explicitly when AI is not configured", async () => {
    await expect(new NotConfiguredAIProvider().embed()).rejects.toBeInstanceOf(AIProviderNotConfiguredError);
  });

  it("uses strict structured output and embedding endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({ apiKey: "secret", baseUrl: "https://api.example/v1/", model: "model", embeddingModel: "embed" });
    await expect(provider.generateStructured("prompt", { type: "object" }, "result")).resolves.toEqual({ ok: true });
    await expect(provider.embed("text")).resolves.toEqual([0.1, 0.2]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example/v1/chat/completions");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body)).response_format.json_schema.strict).toBe(true);
  });

  it("uses OpenRouter structured-output routing with a free model fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({ apiKey: "secret", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", embeddingModel: "embed" });
    await provider.generateStructured("prompt", { type: "object" }, "result");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe("google/gemma-4-26b-a4b-it:free");
    expect(body.models).toEqual(["openrouter/free"]);
    expect(body.provider).toEqual({ require_parameters: true, allow_fallbacks: true, sort: "latency" });
    expect(body.response_format.type).toBe("json_schema");
  });

  it("retries transient OpenRouter provider failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Provider returned error" } }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({ apiKey: "secret", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", embeddingModel: "embed" });
    await expect(provider.generateStructured("prompt", { type: "object" }, "result")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces provider errors and missing response data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })));
    const provider = new OpenAICompatibleProvider({ apiKey: "secret", baseUrl: "https://api.example", model: "model", embeddingModel: "embed" });
    await expect(provider.embed("text")).rejects.toThrow("quota");
  });
});
