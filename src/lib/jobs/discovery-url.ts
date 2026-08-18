export type CanonicalJobLink = {
  url: string;
  sourceId?: string;
};

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function linkedinId(url: URL): string | undefined {
  const match = url.pathname.match(/\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})(?:[/?#]|$)/i);
  return match?.[1];
}

function indeedKey(url: URL): string | undefined {
  const fromQuery = url.searchParams.get("jk")?.trim();
  if (fromQuery && /^[a-z0-9]+$/i.test(fromQuery)) return fromQuery;
  const pathMatch = url.pathname.match(/\/viewjob\/([a-z0-9]+)(?:[/?#]|$)/i);
  return pathMatch?.[1];
}

function xingId(url: URL): string | undefined {
  return url.pathname.match(/-(\d{6,})(?:[/?#]|$)/)?.[1];
}

export function canonicalDiscoveryJobUrl(value: string): CanonicalJobLink | undefined {
  const parsed = safeUrl(value);
  if (!parsed || parsed.protocol !== "https:") return undefined;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    const id = linkedinId(parsed);
    if (!id) return undefined;
    return { url: `https://www.linkedin.com/jobs/view/${id}`, sourceId: id };
  }

  if (host === "indeed.com" || host.endsWith(".indeed.com")) {
    const jk = indeedKey(parsed);
    // Reject transient pagead/rc/clk links without a stable Indeed job key.
    if (!jk) return undefined;
    const countryHost = host.startsWith("de.") ? "de.indeed.com" : host.startsWith("eg.") ? "eg.indeed.com" : "www.indeed.com";
    return { url: `https://${countryHost}/viewjob?jk=${encodeURIComponent(jk)}`, sourceId: jk };
  }

  if (host === "xing.com" || host.endsWith(".xing.com")) {
    const id = xingId(parsed);
    if (!id) return undefined;
    parsed.hash = "";
    return { url: parsed.toString(), sourceId: id };
  }

  if (host.includes("glassdoor.")) {
    if (!/\/job-listing\/|\/partner\/joblisting/i.test(parsed.pathname)) return undefined;
    parsed.hash = "";
    return { url: parsed.toString() };
  }

  parsed.hash = "";
  return { url: parsed.toString() };
}
