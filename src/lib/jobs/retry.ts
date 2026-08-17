export async function withRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { attempts?: number; timeoutMs?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
    try {
      return await operation(controller.signal);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, (options.baseDelayMs ?? 250) * 2 ** attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}
