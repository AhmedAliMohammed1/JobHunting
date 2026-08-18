import { describe, expect, it, vi } from "vitest";
import { createFallbackSearchDiscoveryProvider } from "@/src/lib/jobs/providers/search-discovery-fallback";
import type { SearchDiscoveryProvider } from "@/src/lib/jobs/providers/discovery";

const options = {
  includeDomains: ["linkedin.com", "de.linkedin.com"],
  maxResults: 20,
};

describe("search discovery fallback", () => {
  it("calls Serper when Tavily returns only non-detail pages", async () => {
    const primarySearch = vi.fn(async () => [{ title: "Software Engineer Jobs | LinkedIn", url: "https://www.linkedin.com/jobs/search/?keywords=software%20engineer", content: "Search results" }]);
    const fallbackSearch = vi.fn(async () => [{ title: "Contabo hiring Software Engineer in Germany | LinkedIn", url: "https://www.linkedin.com/jobs/view/software-engineer-at-contabo-4410824202", content: "2 days ago" }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "serper", search: fallbackSearch };
    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("Software Engineer Germany", options);
    expect(primarySearch).toHaveBeenCalledTimes(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
    expect(results.some((result) => result.url.includes("/jobs/view/"))).toBe(true);
  });

  it("keeps results from both indexes when major-board detail pages differ", async () => {
    const primarySearch = vi.fn(async () => [{
      title: "Tavily LinkedIn hit",
      url: "https://www.linkedin.com/jobs/view/software-engineer-at-example-4410824998",
      content: "Software role · today",
      score: 0.8,
    }]);
    const fallbackSearch = vi.fn(async () => [{
      title: "Serper LinkedIn hit",
      url: "https://www.linkedin.com/jobs/view/software-engineer-at-example-4410824999",
      content: "1 day ago",
    }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "serper", search: fallbackSearch };
    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("Software Engineer Germany", options);
    expect(primarySearch).toHaveBeenCalledTimes(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
  });

  it("never loses a posting date when the same job is returned by both indexes", async () => {
    const url = "https://www.linkedin.com/jobs/view/embedded-software-engineer-at-example-4410824998";
    const primarySearch = vi.fn(async () => [{
      title: "Example hiring Embedded Software Engineer in Germany | LinkedIn",
      url,
      content: "A much longer undated snippet about embedded software development, firmware, RTOS, C++, automotive systems and validation responsibilities.".repeat(5),
      score: 0.95,
    }]);
    const fallbackSearch = vi.fn(async () => [{
      title: "Embedded Software Engineer | LinkedIn",
      url,
      content: "2 days ago",
      publishedDate: "2026-08-16T10:00:00.000Z",
      score: 0.4,
    }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "serper", search: fallbackSearch };
    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);

    const results = await provider.search("Embedded Software Engineer Germany", options);

    expect(results).toHaveLength(1);
    expect(results[0].publishedDate).toBe("2026-08-16T10:00:00.000Z");
    expect(results[0].content?.length).toBeGreaterThan(200);
  });

  it.each(["stepstone.de", "xing.com"])("queries both indexes for %s instead of letting one index suppress the other", async (domain) => {
    const primarySearch = vi.fn(async () => []);
    const fallbackSearch = vi.fn(async () => []);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "serper", search: fallbackSearch };
    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);

    await provider.search("Embedded Software Engineer Germany", { includeDomains: [domain], maxResults: 12 });

    expect(primarySearch).toHaveBeenCalledTimes(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
  });

  it("runs Serper on domainless recovery queries because source validity cannot be known at the composite layer", async () => {
    const primarySearch = vi.fn(async () => [{
      title: "Generic search result",
      url: "https://example.com/jobs/software-engineer",
      content: "Generic result",
    }]);
    const fallbackSearch = vi.fn(async () => [{
      title: "LinkedIn Software Engineer",
      url: "https://www.linkedin.com/jobs/view/software-engineer-at-example-4410825000",
      content: "today",
    }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "serper", search: fallbackSearch };
    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("LinkedIn Jobs Software Engineer Germany", { maxResults: 20 });
    expect(primarySearch).toHaveBeenCalledTimes(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
  });

  it("uses Serper when Tavily fails without making aggregate discovery fail", async () => {
    const primarySearch = vi.fn(async () => { throw new Error("Tavily unavailable"); });
    const fallbackSearch = vi.fn(async () => [{ title: "Software Engineer at Example", url: "https://www.linkedin.com/jobs/view/software-engineer-at-example-4410824999", content: "1 day ago" }]);
    const primary: SearchDiscoveryProvider = { id: "tavily", search: primarySearch };
    const fallback: SearchDiscoveryProvider = { id: "serper", search: fallbackSearch };
    const provider = createFallbackSearchDiscoveryProvider([primary, fallback]);
    const results = await provider.search("Software Engineer Germany", options);
    expect(results).toHaveLength(1);
    expect(fallbackSearch).toHaveBeenCalledTimes(1);
  });
});
