import { describe, expect, it, vi } from "vitest";
import type { JobSearchQuery } from "@/src/types/jobs";

vi.mock("@/src/lib/jobs/providers", () => ({
  configuredJobProviders: () => [
    {
      id: "failing",
      name: "Failing provider",
      sourceType: "official-api",
      async search() { throw new Error("deliberate failure"); },
    },
    {
      id: "healthy",
      name: "Healthy provider",
      sourceType: "official-api",
      async search() {
        const now = new Date().toISOString();
        return [{
          id: "healthy-1", externalId: "1", provider: "healthy", sourceType: "official-api", title: "Software Engineer", company: "Example",
          location: "Berlin, Germany", country: "Germany", workplaceType: "unknown", employmentType: "Full-time", skills: [], postedAt: now,
          firstDiscoveredAt: now, lastSeenAt: now, lastVerifiedAt: now, sourceUrl: "https://jobs.example.com/job/1", status: "ACTIVE", freshnessLabel: "live",
        }];
      },
    },
  ],
}));

import { searchJobs } from "@/src/lib/jobs/search";

function query(): JobSearchQuery {
  return { keywords: [], roles: ["Software Engineer"], locations: [], countries: ["Germany"], employmentTypes: ["Full-time"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], providers: [], postedWithinHours: 24, limit: 25 };
}

describe("multi-source provider isolation", () => {
  it("returns healthy results when another provider fails", async () => {
    const result = await searchJobs(query());
    expect(result.partial).toBe(true);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].provider).toBe("healthy");
    expect(result.providers.find((provider) => provider.providerId === "failing")?.health.ok).toBe(false);
    expect(result.providers.find((provider) => provider.providerId === "healthy")?.health.ok).toBe(true);
  });
});
