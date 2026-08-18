import { isLikelyJobUrl, type SearchDiscoveryProvider } from "./discovery";

function hostnameMatchesDomain(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const expected = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return Boolean(expected) && (host === expected || host.endsWith(`.${expected}`));
  } catch {
    return false;
  }
}

function hasUsableResult(
  results: Awaited<ReturnType<SearchDiscoveryProvider["search"]>>,
  domains: string[] | undefined,
): boolean {
  if (!results.length) return false;

  // Domainless discovery is deliberately used as a recovery path. Without an
  // expected domain, this layer cannot know whether a result belongs to the
  // requested source, so continue through the provider chain and merge results.
  if (!domains?.length) return false;

  return results.some((result) =>
    (result.score ?? 1) >= 0.25
    && isLikelyJobUrl(result.url)
    && domains.some((domain) => hostnameMatchesDomain(result.url, domain)),
  );
}

function mergeByUrl(
  current: Awaited<ReturnType<SearchDiscoveryProvider["search"]>>,
  incoming: Awaited<ReturnType<SearchDiscoveryProvider["search"]>>,
): Awaited<ReturnType<SearchDiscoveryProvider["search"]>> {
  const byUrl = new Map(current.map((result) => [result.url, result]));
  for (const result of incoming) byUrl.set(result.url, result);
  return [...byUrl.values()];
}

export function createFallbackSearchDiscoveryProvider(providers: SearchDiscoveryProvider[]): SearchDiscoveryProvider {
  if (!providers.length) throw new Error("At least one search discovery provider is required");
  if (providers.length === 1) return providers[0];

  return {
    id: providers.map((provider) => provider.id).join("->"),
    async search(query, options, signal) {
      let combined: Awaited<ReturnType<SearchDiscoveryProvider["search"]>> = [];
      let lastError: unknown;

      for (const provider of providers) {
        try {
          const results = await provider.search(query, options, signal);
          combined = mergeByUrl(combined, results);
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
