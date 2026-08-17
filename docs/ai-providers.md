# AI providers

`src/lib/ai/provider.ts` defines a narrow interface for structured generation and embeddings. Modes are `mock`, `openai-compatible`, and `not-configured`. Provider calls run server-side with timeouts; responses are schema-validated with Zod before entering product logic.

AI may extract explicit CV/job facts, expand search intent, draft cover letters from approved facts, and explain deterministic matches. Manual profile fields remain authoritative. Unknown facts remain unknown. Sensitive eligibility, demographic, work-authorization, salary, and legal answers are never inferred.

The OpenAI-compatible adapter uses JSON Schema structured output and a dedicated embedding model. Pin and evaluate model changes, hash source content to avoid redundant embedding, and record provider/model metadata with stored vectors. The deterministic match score remains usable when AI is unavailable.
