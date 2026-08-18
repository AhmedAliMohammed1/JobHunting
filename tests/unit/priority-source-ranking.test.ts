import { describe, expect, it } from "vitest";
import { normalizedJob } from "@/src/lib/jobs/normalize";
import { providerPriority, rankWithoutProfile } from "@/src/lib/jobs/search";
import type { JobSearchQuery } from "@/src/types/jobs";

const query: JobSearchQuery = {
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
};

function job(provider: string, postedAt: string) {
  return normalizedJob({
    provider,
    sourceType: provider === "adzuna" ? "official-api" : "search-discovery",
    externalId: `${provider}-1`,
    title: "Software Engineer",
    company: "Example Company",
    location: "Germany",
    description: "Software Engineer role in Germany",
    postedAt,
    sourceUrl: `https://example.com/${provider}-1`,
  });
}

describe("priority job sources", () => {
  it("assigns LinkedIn, Indeed and XING the highest provider priority", () => {
    expect(providerPriority({ provider: "linkedin" })).toBeGreaterThan(providerPriority({ provider: "adzuna" }));
    expect(providerPriority({ provider: "indeed" })).toBeGreaterThan(providerPriority({ provider: "jooble" }));
    expect(providerPriority({ provider: "xing" })).toBeGreaterThan(providerPriority({ provider: "stepstone" }));
  });

  it("ranks equally relevant and equally fresh LinkedIn, Indeed and XING jobs above other sources", () => {
    const postedAt = new Date().toISOString();
    const ranked = rankWithoutProfile([
      job("adzuna", postedAt),
      job("xing", postedAt),
      job("indeed", postedAt),
      job("linkedin", postedAt),
    ], query);

    expect(ranked.map((item) => item.provider)).toEqual(["linkedin", "indeed", "xing", "adzuna"]);
  });
});
