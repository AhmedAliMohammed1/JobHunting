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
    expect(calls[0].query).toContain("Software Engineer");
    expect(calls[0].query).toContain("Germany");
    expect(jobs[0]).toMatchObject({ provider: "linkedin", company: "Contabo", title: "Software Engineer (all genders)", location: "Deutschland" });
    expect(jobs[0].postedAt).toBeTruthy();
  });

  it.each([
    ["linkedin", "site:de.linkedin.com/jobs/view", "https://de.linkedin.com/jobs/view/software-engineer-at-example-4455296976"],
    ["indeed", "site:de.indeed.com/viewjob", "https://de.indeed.com/viewjob?jk=9e2eb651b93dfbe4"],
    ["glassdoor", "site:glassdoor.de/job-listing", "https://www.glassdoor.de/job-listing/software-engineer-example-JV_KO0,17_KE18,25.htm?jl=1010230646697"],
  ])("retries %s with a Germany-localized individual job-detail path query", async (source, pathOperator, detailUrl) => {
    const calls: Array<{ query: string; options: Record<string, unknown> }> = [];
    const fake: SearchDiscoveryProvider = {
      id: "fake",
      async search(searchQuery, options) {
        calls.push({ query: searchQuery, options: options as unknown as Record<string, unknown> });
        if (calls.length === 1) return [];
        return [{
          title: "Software Engineer at Example",
          url: detailUrl,
          content: "1 day ago · Full-time",
          score: 0.8,
        }];
      },
    };

    const provider = createDiscoveryJobProvider(fake);
    const jobs = await provider.search(query({ providers: [source] }));

    expect(calls).toHaveLength(2);
    expect(calls[1].query).toContain(pathOperator);
    expect(calls[1].query).toContain('"Software Engineer"');
    expect(calls[1].options.includeDomains).toBeUndefined();
    expect(calls[1].options.postedWithinHours).toBe(168);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].provider).toBe(source);
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
