import { createHash } from "node:crypto";
import { z } from "zod";
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

export function createSerperSearchProvider(apiKey: string, cacheTtlSeconds = 600): SearchDiscoveryProvider {
  return {
    id: "serper",
    async search(query, options, signal) {
      const key = cacheKey(query, options);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const body: Record<string, unknown> = {
        q: withSiteOperators(query, options.includeDomains),
        num: Math.min(20, Math.max(1, options.maxResults ?? 10)),
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
      const value = parsed.organic.map((result) => ({
        title: result.title,
        url: result.link,
        content: [result.snippet ?? "", result.date ?? ""].filter(Boolean).join(" "),
        score: result.position ? 1 / Math.max(1, result.position) : undefined,
        publishedDate: result.date ?? undefined,
      }));
      cache.set(key, { expiresAt: Date.now() + cacheTtlSeconds * 1_000, value });
      return value;
    },
  };
}
