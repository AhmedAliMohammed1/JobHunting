import { canonicalDiscoveryJobUrl } from "../discovery-url";
import { isLikelyJobUrl, type SearchDiscoveryProvider } from "./discovery";

type Results = Awaited<ReturnType<SearchDiscoveryProvider["search"]>>;

function hostnameMatchesDomain(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const expected = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return Boolean(expected) && (host === expected || host.endsWith(`.${expected}`));
  } catch {
    return false;
  }
}

function stableResults(results: Results): Results {
  return results.filter((result) => canonicalDiscoveryJobUrl(result.url));
}

function metadataScore(result: Results[number]): number {
  const title = result.title?.trim() ?? "";
  const content = result.content?.trim() ?? "";
  let score = Math.min(content.length, 800) / 80;
  if (title.length > 8) score += 2;
  // A verified/index-provided posting date is more important than a longer
  // snippet. Losing this field later causes strict 24h/72h filters to discard
  // an otherwise valid listing.
  if (result.publishedDate) score += 25;
  if (/\b(?:hiring|sucht|at|bei)\b/i.test(title)) score += 2;
  if (/\b(?:Germany|Deutschland|Berlin|Munich|München|Hamburg|Frankfurt|Cologne|Köln|Stuttgart|Remote)\b/i.test(`${title} ${content}`)) score += 1;
  return score;
}

function mergeResultMetadata(left: Results[number], right: Results[number]): Results[number] {
  const preferred = metadataScore(right) >= metadataScore(left) ? right : left;
  const other = preferred === right ? left : right;
  const richerContent = (preferred.content?.length ?? 0) >= (other.content?.length ?? 0) ? preferred.content : other.content;
  return {
    ...other,
    ...preferred,
    title: preferred.title || other.title,
    content: richerContent,
    publishedDate: preferred.publishedDate ?? other.publishedDate,
    employmentType: preferred.employmentType ?? other.employmentType,
    seniority: preferred.seniority ?? other.seniority,
    score: Math.max(preferred.score ?? 0, other.score ?? 0) || undefined,
  };
}

function mergeByStableJob(current: Results, incoming: Results): Results {
  const byKey = new Map<string, Results[number]>();
  for (const result of [...current, ...incoming]) {
    const canonical = canonicalDiscoveryJobUrl(result.url);
    if (!canonical) continue;
    const key = canonical.sourceId ? `${new URL(canonical.url).hostname}:${canonical.sourceId}` : canonical.url;
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeResultMetadata(existing, result) : result);
  }
  return [...byKey.values()];
}

function shouldAggregateIndexes(domains: string[] | undefined): boolean {
  const text = (domains ?? []).join(" ").toLowerCase();
  // Major boards are indexed differently by Tavily and Google. Query both in
  // parallel so a thin/stale index cannot suppress valid listings from the other.
  return /linkedin|indeed|glassdoor|stepstone|xing/.test(text);
}

function hasUsableResult(results: Results, domains: string[] | undefined): boolean {
  const stable = stableResults(results);
  if (!stable.length) return false;
  if (!domains?.length) return false;
  if (shouldAggregateIndexes(domains)) return false;

  return stable.some((result) =>
    (result.score ?? 1) >= 0.25
    && isLikelyJobUrl(result.url)
    && domains.some((domain) => hostnameMatchesDomain(result.url, domain)),
  );
}

export function createFallbackSearchDiscoveryProvider(providers: SearchDiscoveryProvider[]): SearchDiscoveryProvider {
  if (!providers.length) throw new Error("At least one search discovery provider is required");

  return {
    id: providers.map((provider) => provider.id).join("->"),
    async search(query, options, signal) {
      if (shouldAggregateIndexes(options.includeDomains)) {
        const settled = await Promise.allSettled(providers.map((provider) => provider.search(query, options, signal)));
        let combined: Results = [];
        let lastError: unknown;

        for (const result of settled) {
          if (result.status === "fulfilled") combined = mergeByStableJob(combined, stableResults(result.value));
          else lastError = result.reason;
        }

        if (combined.length) return combined;
        if (lastError) throw lastError;
        return [];
      }

      let combined: Results = [];
      let lastError: unknown;

      for (const provider of providers) {
        try {
          const results = stableResults(await provider.search(query, options, signal));
          combined = mergeByStableJob(combined, results);
          if (hasUsableResult(results, options.includeDomains)) return combined;
        } catch (error) {
          lastError = error;
        }
      }

      if (combined.length) return combined;
      if (lastError) throw lastError;
      return [];
    },
  };
}
