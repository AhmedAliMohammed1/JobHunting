import { describe, expect, it, vi } from "vitest";
import { createFallbackSearchDiscoveryProvider } from "@/src/lib/jobs/providers/search-discovery-fallback";
import type { SearchDiscoveryProvider } from "@/src/lib/jobs/providers/discovery";

const options = {
  includeDomains: ["linkedin.com", "de.linkedin.com"],
  maxResults: 20,
};

describe("search discovery fallback", () => {
  it("calls Brave when Tavily returns only non-detail pages", async () => {
    const primarySearch = vi.fn(async () => [{
      title: "Software Engineer Jobs | LinkedIn",
      url: "https://www.linkedin.com/jobs/search/?keywords=software%20engineer",
      content: "Search results",
    }]);
    const fallbackSearch = vi.fn(async () => [{
      title: "Contabo hiring Software Engineer in Germany | LinkedIn",
      url: "https://www.linkedin.com/jobs/view/software-engineer-at-contabo-4410824202",
      content: "2 days ago",
    }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "brave", search: fallbackSearch };

    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("Software Engineer Germany", options);

    expect(primarySearch).toHaveBeenCalledTimes(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
    expect(results.some((result) => result.url.includes("/jobs/view/"))).toBe(true);
  });

  it("does not spend a Brave request when Tavily already has a valid detail page", async () => {
    const primarySearch = vi.fn(async () => [{
      title: "Contabo hiring Software Engineer in Germany | LinkedIn",
      url: "https://www.linkedin.com/jobs/view/software-engineer-at-contabo-4410824202",
      content: "2 days ago",
    }]);
    const fallbackSearch = vi.fn(async () => []);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "brave", search: fallbackSearch };

    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("Software Engineer Germany", options);

    expect(results).toHaveLength(1);
    expect(fallbackSearch).not.toHaveBeenCalled();
  });

  it("uses Brave when Tavily fails without making the aggregate discovery provider fail", async () => {
    const primarySearch = vi.fn(async () => { throw new Error("Tavily unavailable"); });
    const fallbackSearch = vi.fn(async () => [{
      title: "Software Engineer at Example",
      url: "https://www.linkedin.com/jobs/view/software-engineer-at-example-4410824999",
      content: "1 day ago",
    }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "brave", search: fallbackSearch };

    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("Software Engineer Germany", options);

    expect(results).toHaveLength(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
  });
});
