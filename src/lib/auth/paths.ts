export function safeReturnPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://jobhunter.local");
    return url.origin === "https://jobhunter.local" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
