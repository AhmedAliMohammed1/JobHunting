const allowedProtocols = new Set(["https:", "http:"]);

export function parseSafeExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!allowedProtocols.has(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function requireHttpsUrl(value: string): URL {
  const url = parseSafeExternalUrl(value);
  if (!url || url.protocol !== "https:") throw new Error("A valid HTTPS URL is required.");
  return url;
}

