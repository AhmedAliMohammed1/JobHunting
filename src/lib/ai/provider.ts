import { getServerEnv } from "@/src/config/env";

export interface AIProvider {
  readonly id: string;
  generateStructured<T>(prompt: string, schema: unknown, schemaName?: string): Promise<T>;
  embed(text: string): Promise<number[]>;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
}

export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured for this environment.");
    this.name = "AIProviderNotConfiguredError";
  }
}

export class NotConfiguredAIProvider implements AIProvider {
  readonly id = "not-configured";
  async generateStructured<T>(): Promise<T> { throw new AIProviderNotConfiguredError(); }
  async embed(): Promise<number[]> { throw new AIProviderNotConfiguredError(); }
}

export class MockAIProvider implements AIProvider {
  readonly id = "mock";
  async generateStructured<T>(_prompt: string, schema: unknown): Promise<T> {
    if (typeof schema === "object" && schema && "mock" in schema) {
      return (schema as { mock: T }).mock;
    }
    throw new Error("Mock AI requires an explicit schema mock fixture.");
  }
  async embed(text: string): Promise<number[]> {
    const values = Array.from({ length: 1536 }, (_, index) => {
      const code = text.charCodeAt(index % Math.max(1, text.length)) || 0;
      return ((code * (index + 17)) % 997) / 997;
    });
    const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    return values.map((value) => value / magnitude);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError" || /timeout|fetch failed|network/i.test(error.message);
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai-compatible";
  constructor(
    private readonly configuration: {
      apiKey: string;
      baseUrl: string;
      model: string;
      embeddingModel: string;
    },
  ) {}

  private async request<T>(
    path: string,
    body: unknown,
    options: { timeoutMs?: number; retries?: number } = {},
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 45_000;
    const retries = options.retries ?? 0;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(`${this.configuration.baseUrl.replace(/\/$/, "")}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.configuration.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
        if (response.ok) return payload;

        const error = new Error(payload.error?.message ?? `AI provider returned ${response.status}.`);
        const retryableStatus = [408, 429, 502, 503].includes(response.status);
        if (!retryableStatus || attempt >= retries) throw error;

        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5_000)
          : 750;
        await sleep(delayMs);
      } catch (error) {
        if (attempt < retries && isTransientNetworkError(error)) {
          await sleep(750);
          continue;
        }
        throw error;
      }
    }

    throw new Error("AI provider request failed after retrying.");
  }

  private isOpenRouter() {
    try {
      return new URL(this.configuration.baseUrl).hostname === "openrouter.ai";
    } catch {
      return false;
    }
  }

  private structuredModel() {
    // The generic free router can randomly select high-latency reasoning models.
    // Pin structured extraction to a currently free model that explicitly supports
    // structured_outputs. Explicitly configured model IDs are always respected.
    if (this.isOpenRouter() && this.configuration.model === "openrouter/free") {
      return "google/gemma-4-26b-a4b-it:free";
    }
    return this.configuration.model;
  }

  async generateStructured<T>(prompt: string, schema: unknown, schemaName = "jobhunter_result"): Promise<T> {
    const requestBody: Record<string, unknown> = {
      model: this.structuredModel(),
      messages: [
        { role: "system", content: "Return only truthful information supported by the supplied context. Never invent unsupported facts. Use null where the schema permits unknown scalar values and empty arrays for unknown list values." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
      temperature: 0.1,
      max_tokens: 2_500,
    };

    if (this.isOpenRouter()) {
      requestBody.provider = {
        require_parameters: true,
        allow_fallbacks: true,
      };
    }

    const payload = await this.request<ChatCompletionResponse>(
      "/chat/completions",
      requestBody,
      this.isOpenRouter() ? { timeoutMs: 60_000, retries: 1 } : { timeoutMs: 45_000, retries: 0 },
    );
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned no structured content.");
    return JSON.parse(content) as T;
  }

  async embed(text: string): Promise<number[]> {
    const payload = await this.request<EmbeddingResponse>("/embeddings", {
      model: this.configuration.embeddingModel,
      input: text,
      encoding_format: "float",
    });
    const embedding = payload.data?.[0]?.embedding;
    if (!embedding?.length) throw new Error("AI provider returned no embedding.");
    return embedding;
  }
}

export function getAIProvider(): AIProvider {
  const env = getServerEnv();
  if (env.AI_PROVIDER === "mock") return new MockAIProvider();
  if (env.AI_PROVIDER === "openai-compatible" && env.AI_API_KEY && env.AI_BASE_URL && env.AI_MODEL) {
    return new OpenAICompatibleProvider({
      apiKey: env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
      embeddingModel: env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    });
  }
  return new NotConfiguredAIProvider();
}
