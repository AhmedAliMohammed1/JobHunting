import { describe, expect, it } from "vitest";
import { createDiscoveryJobProvider, type SearchDiscoveryProvider } from "@/src/lib/jobs/providers/discovery";
import type { JobSearchQuery } from "@/src/types/jobs";

const baseQuery: JobSearchQuery = {
  roles: ["Software Engineer"],
  keywords: [],
  locations: [],
  countries: ["Germany"],
  companies: [],
  excludedCompanies: [],
  employmentTypes: ["Full-time"],
  workplaceTypes: [],
  experienceLevels: [],
  providers: [],
  postedWithinHours: 168,
  limit: 50,
};

describe("job discovery source fan-out", () => {
  it("queries major job boards separately and skips generic career pages for broad searches", async () => {
    const calls: Array<{ domains?: string[] }> = [];
    const searchProvider: SearchDiscoveryProvider = {
      id: "test",
      async search(_query, options) {
        calls.push({ domains: options.includeDomains });
        return [];
      },
    };

    await createDiscoveryJobProvider(searchProvider).search(baseQuery);

    expect(calls.some((call) => call.domains?.includes("linkedin.com"))).toBe(true);
    expect(calls.some((call) => call.domains?.includes("indeed.com"))).toBe(true);
    expect(calls.some((call) => call.domains?.includes("stepstone.de"))).toBe(true);
    expect(calls.some((call) => call.domains?.includes("xing.com"))).toBe(true);
    expect(calls.some((call) => call.domains?.includes("glassdoor.com"))).toBe(true);
    expect(calls.some((call) => call.domains === undefined)).toBe(false);
  });

  it("allows generic career-page discovery when a company is explicitly requested", async () => {
    const calls: Array<{ domains?: string[] }> = [];
    const searchProvider: SearchDiscoveryProvider = {
      id: "test",
      async search(_query, options) {
        calls.push({ domains: options.includeDomains });
        return [];
      },
    };

    await createDiscoveryJobProvider(searchProvider).search({ ...baseQuery, companies: ["Bosch"] });
    expect(calls.some((call) => call.domains === undefined)).toBe(true);
  });
});
