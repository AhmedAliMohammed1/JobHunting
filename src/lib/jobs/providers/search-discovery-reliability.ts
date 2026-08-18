import type { SearchDiscoveryProvider } from "./discovery";

/**
 * Keep an explicit user freshness window authoritative at the provider boundary.
 * Individual discovery strategies may omit their local date option, but Tavily
 * and Serper must still receive the requested window.
 */
export function withDefaultDiscoveryRecency(
  provider: SearchDiscoveryProvider,
  postedWithinHours: number | undefined,
): SearchDiscoveryProvider {
  if (!postedWithinHours) return provider;

  return {
    id: provider.id,
    search(query, options, signal) {
      return provider.search(query, {
        ...options,
        postedWithinHours: options.postedWithinHours ?? postedWithinHours,
      }, signal);
    },
  };
}
