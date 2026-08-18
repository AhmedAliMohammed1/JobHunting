import { createHash } from "node:crypto";
import { z } from "zod";
import type { SearchDiscoveryProvider } from "./discovery";

const braveResponseSchema = z.object({
  web: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string().url(),
      description: z.string().nullish(),
      age: z.string().nullish(),
      extra_snippets: z.array(z.string()).nullish(),
    }).passthrough()).default([]),
  }).nullish(),
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
  const combined = [query.trim(), siteExpression].filter(Boolean).join(" ");
  return combined.split(/\s+/).slice(0, 50).join(" ").slice(0, 400);
}

function freshnessForHours(hours: number | undefined): string | undefined {
  if (!hours) return undefined;
  if (hours <= 24) return "pd";
  if (hours <= 168) return "pw";
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3_600_000);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  return `${date(start)}to${date(end)}`;
}

function countryForQuery(query: string): string | undefined {
  if (/\b(?:germany|deutschland|german)\b/i.test(query)) return "DE";
  if (/\b(?:egypt|egyptian|ägypten)\b/i.test(query)) return "EG";
  return undefined;
}

export function createBraveSearchProvider(apiKey: string, cacheTtlSeconds = 600): SearchDiscoveryProvider {
  return {
    id: "brave",
    async search(query, options, signal) {
      const key = cacheKey(query, options);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const params = new URLSearchParams({
        q: withSiteOperators(query, options.includeDomains),
        count: String(Math.min(20, Math.max(1, options.maxResults ?? 12))),
        safesearch: "moderate",
        spellcheck: "true",
        result_filter: "web",
        text_decorations: "false",
      });
      const country = countryForQuery(query);
      if (country) params.set("country", country);
      const freshness = freshnessForHours(options.postedWithinHours);
      if (freshness) params.set("freshness", freshness);

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
        method: "GET",
        signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      });
      if (!response.ok) throw new Error(`Brave Search returned ${response.status}`);

      const parsed = braveResponseSchema.parse(await response.json());
      const value = (parsed.web?.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        content: [result.description ?? "", ...(result.extra_snippets ?? []), result.age ?? ""]
          .filter(Boolean)
          .join(" "),
      }));
      cache.set(key, { expiresAt: Date.now() + cacheTtlSeconds * 1_000, value });
      return value;
    },
  };
}
