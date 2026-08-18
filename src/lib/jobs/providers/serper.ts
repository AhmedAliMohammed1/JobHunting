import { createHash } from "node:crypto";
import { z } from "zod";
import { inferDiscoveryPostedAt } from "../discovery-metadata";
import { canonicalDiscoveryJobUrl } from "../discovery-url";
import { fetchPublicJobPageMetadata } from "../job-page-metadata";
import type { SearchDiscoveryProvider } from "./discovery";

const serperResponseSchema = z.object({
  organic: z.array(z.object({
    title: z.string(),
    link: z.string().url(),
    snippet: z.string().nullish(),
    date: z.string().nullish(),
    position: z.number().nullish(),
  }).passthrough()).default([]),
}).passthrough();

const cache = new Map<string, { expiresAt: number; value: Array<{ title: string; url: string; content?: string; score?: number; publishedDate?: string }> }>();

function cacheKey(query: string, options: unknown): string {
  return createHash("sha256").update(JSON.stringify([query, options])).digest("hex");
}

function normalizedDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function withSiteOperators(query: string, domains: string[] | undefined): string {
  const sites = [...new Set((domains ?? []).map(normalizedDomain).filter(Boolean))].slice(0, 6);
  const siteExpression = sites.length ? `(${sites.map((domain) => `site:${domain}`).join(" OR ")})` : "";
  return [query.trim(), siteExpression].filter(Boolean).join(" ").slice(0, 1900);
}

function countryForQuery(query: string): string | undefined {
  if (/\b(?:germany|deutschland|german)\b/i.test(query)) return "de";
  if (/\b(?:egypt|egyptian|ägypten)\b/i.test(query)) return "eg";
  return undefined;
}

function languageForQuery(query: string): string {
  if (/[\u0600-\u06ff]/.test(query)) return "ar";
  if (/\b(?:deutschland|werkstudent|praktikum|vollzeit|teilzeit|stellenangebote)\b/i.test(query)) return "de";
  return "en";
}

function recencyTbs(hours: number | undefined): string | undefined {
  if (!hours) return undefined;
  if (hours <= 24) return "qdr:d";
  if (hours <= 168) return "qdr:w";
  if (hours <= 744) return "qdr:m";
  return undefined;
}

function sourceForUrl(url: string): "linkedin" | "indeed" | "glassdoor" | "other" {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("indeed.com")) return "indeed";
    if (host.includes("glassdoor.")) return "glassdoor";
  } catch {
    // ignored
  }
  return "other";
}

function indexedTitle(value: string): string {
  return value.replace(/\s*[|–-]\s*(LinkedIn|Indeed(?:\.com)?|Glassdoor)\s*$/i, "").trim();
}

function enrichedSearchShape(result: { title: string; link: string; snippet?: string | null; date?: string | null }, page: Awaited<ReturnType<typeof fetchPublicJobPageMetadata>>) {
  const source = sourceForUrl(result.link);
  const title = page.title ?? indexedTitle(result.title);
  const company = page.company;
  const location = page.location;

  let shapedTitle = result.title;
  let structuredPrefix = "";
  if (company && location && source === "linkedin") shapedTitle = `${company} hiring ${title} in ${location} | LinkedIn`;
  else if (company && location && source === "glassdoor") shapedTitle = `${company} hiring ${title} in ${location} | Glassdoor`;
  else if (company && source === "indeed") structuredPrefix = `${title}. ${company}.${location ? ` ${location}.` : ""}`;

  const content = [structuredPrefix, page.description, result.snippet ?? "", result.date ?? ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: shapedTitle,
    url: result.link,
    content,
    publishedDate: inferDiscoveryPostedAt(page.datePosted ?? result.date ?? undefined, undefined),
  };
}

export function createSerperSearchProvider(apiKey: string, cacheTtlSeconds = 600): SearchDiscoveryProvider {
  return {
    id: "serper",
    async search(query, options, signal) {
      const key = cacheKey(query, options);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const body: Record<string, unknown> = {
        q: withSiteOperators(query, options.includeDomains),
        num: Math.min(10, Math.max(1, options.maxResults ?? 10)),
        hl: languageForQuery(query),
      };
      const country = countryForQuery(query);
      if (country) body.gl = country;
      const tbs = recencyTbs(options.postedWithinHours);
      if (tbs) body.tbs = tbs;

      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Serper returned ${response.status}`);

      const parsed = serperResponseSchema.parse(await response.json());
      const candidates = parsed.organic.filter((result) => canonicalDiscoveryJobUrl(result.link));
      const enriched = await Promise.all(candidates.map(async (result) => {
        const page = await fetchPublicJobPageMetadata(result.link, signal);
        if (page.dead) return undefined;
        return enrichedSearchShape(result, page);
      }));
      const value = enriched.filter((result): result is NonNullable<typeof result> => Boolean(result));
      cache.set(key, { expiresAt: Date.now() + cacheTtlSeconds * 1_000, value });
      return value;
    },
  };
}
