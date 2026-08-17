import { describe, expect, it } from "vitest";
import { jobMatchesQuery } from "@/src/lib/jobs/search";
import type { JobSearchQuery, NormalizedJob } from "@/src/types/jobs";

const now = Date.parse("2026-08-17T12:00:00.000Z");
const job: NormalizedJob = {
  id: "job-1",
  provider: "fixture",
  title: "Senior Frontend Engineer",
  company: "Northstar Systems",
  location: "Berlin, Germany · Remote",
  country: "Germany",
  workplaceType: "remote",
  employmentType: "Full-time",
  seniority: "Senior",
  salaryMin: 85_000,
  salaryMax: 110_000,
  description: "Build accessible React products with TypeScript.",
  skills: ["TypeScript", "React"],
  postedAt: "2026-08-17T06:00:00.000Z",
  firstDiscoveredAt: "2026-08-17T06:00:00.000Z",
  lastSeenAt: "2026-08-17T06:00:00.000Z",
  sourceUrl: "https://jobs.example/job-1",
  status: "ACTIVE",
  freshnessLabel: "live",
};

function query(overrides: Partial<JobSearchQuery> = {}): JobSearchQuery {
  return {
    keywords: [], roles: [], locations: [], countries: [], employmentTypes: [], workplaceTypes: [],
    experienceLevels: [], companies: [], excludedCompanies: [], providers: [], limit: 25, ...overrides,
  };
}

describe("job search result filtering", () => {
  it("matches a multi-word phrase using the title and skills", () => {
    expect(jobMatchesQuery(job, query({ roles: ["TypeScript engineer"] }), now)).toBe(true);
    expect(jobMatchesQuery(job, query({ roles: ["machine learning"] }), now)).toBe(false);
  });

  it("requires both the role group and the keyword group", () => {
    expect(jobMatchesQuery(job, query({ roles: ["Engineer"], keywords: ["TypeScript"] }), now)).toBe(true);
    expect(jobMatchesQuery(job, query({ roles: ["Engineer"], keywords: ["Python"] }), now)).toBe(false);
  });

  it("enforces location, workplace, company, employment, and seniority filters", () => {
    expect(jobMatchesQuery(job, query({ locations: ["Berlin"], countries: ["Germany"], workplaceTypes: ["remote"], companies: ["Northstar"], employmentTypes: ["full"], experienceLevels: ["senior"] }), now)).toBe(true);
    expect(jobMatchesQuery(job, query({ locations: ["Berlin"], countries: ["France"] }), now)).toBe(false);
    expect(jobMatchesQuery(job, query({ workplaceTypes: ["hybrid"] }), now)).toBe(false);
    expect(jobMatchesQuery(job, query({ excludedCompanies: ["northstar"] }), now)).toBe(false);
    expect(jobMatchesQuery(job, query({ providers: ["fixture"] }), now)).toBe(true);
    expect(jobMatchesQuery(job, query({ providers: ["arbeitnow"] }), now)).toBe(false);
  });

  it("enforces freshness and structured salary thresholds", () => {
    expect(jobMatchesQuery(job, query({ postedWithinHours: 12, minimumSalary: 100_000 }), now)).toBe(true);
    expect(jobMatchesQuery(job, query({ postedWithinHours: 4 }), now)).toBe(false);
    expect(jobMatchesQuery(job, query({ minimumSalary: 120_000 }), now)).toBe(false);
    expect(jobMatchesQuery({ ...job, postedAt: undefined, salaryMin: undefined, salaryMax: undefined }, query({ postedWithinHours: 24, minimumSalary: 1 }), now)).toBe(false);
  });
});
