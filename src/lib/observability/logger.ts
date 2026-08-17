type LogLevel = "debug" | "info" | "warn" | "error";
type SafeMetadata = Record<string, string | number | boolean | null | undefined>;

const blockedKeys = /cv|resume|password|token|secret|credential|answer|authorization/i;

function sanitize(metadata: SafeMetadata = {}): SafeMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !blockedKeys.test(key)),
  );
}

export function log(level: LogLevel, event: string, metadata?: SafeMetadata) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(metadata),
  };
  const serialized = JSON.stringify(entry);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export async function timed<T>(
  event: string,
  operation: () => Promise<T>,
  metadata?: SafeMetadata,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    log("info", event, { ...metadata, durationMs: Math.round(performance.now() - start) });
    return result;
  } catch (error) {
    log("error", event, {
      ...metadata,
      durationMs: Math.round(performance.now() - start),
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

