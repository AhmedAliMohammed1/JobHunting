type PageJobMetadata = {
  title?: string;
  company?: string;
  location?: string;
  datePosted?: string;
  description?: string;
  dead?: boolean;
};

type JsonObject = Record<string, unknown>;

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  return clean || undefined;
}

function objects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (!value || typeof value !== "object") return [];
  const object = value as JsonObject;
  const graph = object["@graph"];
  return [object, ...objects(graph)];
}

function isJobPosting(object: JsonObject): boolean {
  const type = object["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

function companyName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  return text((value as JsonObject).name);
}

function addressText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as JsonObject;
  const address = object.address && typeof object.address === "object" ? object.address as JsonObject : object;
  return [address.addressLocality, address.addressRegion, address.addressCountry]
    .map(text)
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(", ") || undefined;
}

function jobLocation(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const locations = value.map(addressText).filter((part): part is string => Boolean(part));
    return [...new Set(locations)].join(" / ") || undefined;
  }
  return addressText(value);
}

function parseJsonLd(html: string): PageJobMetadata | undefined {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const posting = objects(parsed).find(isJobPosting);
      if (!posting) continue;
      return {
        title: text(posting.title),
        company: companyName(posting.hiringOrganization),
        location: jobLocation(posting.jobLocation),
        datePosted: text(posting.datePosted),
        description: text(posting.description),
      };
    } catch {
      // Ignore malformed third-party JSON-LD and continue to the next script.
    }
  }
  return undefined;
}

function canonicalMeta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return text(html.match(expression)?.[1]);
}

export async function fetchPublicJobPageMetadata(url: string, signal?: AbortSignal): Promise<PageJobMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; JobHuntingMetadata/1.0; +public-job-metadata)",
      },
    });

    if (response.status === 404 || response.status === 410) return { dead: true };
    if (!response.ok) return {};
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return {};

    const html = (await response.text()).slice(0, 1_500_000);
    const structured = parseJsonLd(html);
    if (structured) return structured;

    return {
      title: canonicalMeta(html, "og:title"),
      description: canonicalMeta(html, "og:description") ?? canonicalMeta(html, "description"),
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
