import { describe, expect, it } from "vitest";
import type { JobSearchQuery } from "@/src/types/jobs";
import { createDiscoveryJobProvider, isLikelyJobUrl, type SearchDiscoveryProvider } from "@/src/lib/jobs/providers/discovery";

function query(overrides: Partial<JobSearchQuery> = {}): JobSearchQuery {
  return {
    keywords: [],
    roles: ["Software Engineer"],
    locations: [],
    countries: ["Germany"],
    employmentTypes: [],
    workplaceTypes: [],
    experienceLevels: [],
    companies: [],
    excludedCompanies: [],
    providers: [],
    postedWithinHours: 168,
    limit: 50,
    ...overrides,
  };
}

describe("major board discovery recall", () => {
  it("uses advanced domain-restricted discovery for LinkedIn without a hard Tavily date filter", async () => {
    const calls: Array<{ query: string; options: Record<string, unknown> }> = [];
    const fake: SearchDiscoveryProvider = {
      id: "fake",
      async search(searchQuery, options) {
        calls.push({ query: searchQuery, options: options as unknown as Record<string, unknown> });
        return [{
          title: "Contabo sucht Software Engineer (all genders) in Deutschland | LinkedIn",
          url: "https://de.linkedin.com/jobs/view/software-engineer-all-genders-at-contabo-4410824202",
          content: "Vor 1 Tag · Full-time · remote-first within Germany",
          score: 0.9,
        }];
      },
    };

    const provider = createDiscoveryJobProvider(fake);
    const jobs = await provider.search(query({ providers: ["linkedin"] }));

    expect(calls).toHaveLength(1);
    expect(calls[0].options.searchDepth).toBe("advanced");
    expect(calls[0].options.postedWithinHours).toBeUndefined();
    expect(calls[0].options.includeDomains).toEqual(expect.arrayContaining(["linkedin.com", "de.linkedin.com"]));
    expect(calls[0].query).toContain("last 7 days");
    expect(jobs[0]).toMatchObject({ provider: "linkedin", company: "Contabo", title: "Software Engineer (all genders)", location: "Deutschland" });
    expect(jobs[0].postedAt).toBeTruthy();
  });

  it("rejects XING search/list pages and keeps individual job-detail URLs", () => {
    expect(isLikelyJobUrl("https://www.xing.com/jobs/t-software-engineer")).toBe(false);
    expect(isLikelyJobUrl("https://www.xing.com/jobs/software-engineer-jobs-in-uetersen")).toBe(false);
    expect(isLikelyJobUrl("https://www.xing.com/jobs/wedel-software-engineer-architektur-156898902")).toBe(true);
  });

  it("does not leak unrelated websites into a source-specific discovery group", async () => {
    const fake: SearchDiscoveryProvider = {
      id: "fake",
      async search() {
        return [{
          title: "Software Engineer English-speaking jobs in Germany",
          url: "https://englishjobs.de/jobs/software_engineer",
          content: "Software engineering jobs in Germany",
          score: 0.9,
        }];
      },
    };

    const provider = createDiscoveryJobProvider(fake);
    const jobs = await provider.search(query({ providers: ["linkedin"] }));
    expect(jobs).toEqual([]);
  });
});
