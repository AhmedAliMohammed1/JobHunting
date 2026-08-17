import { describe, expect, it } from "vitest";
import type { JobSearchQuery } from "@/src/types/jobs";
import { arbeitnowProvider } from "@/src/lib/jobs/providers/arbeitnow";
import { jobMatchesQuery } from "@/src/lib/jobs/search";

const scenarios: JobSearchQuery[] = [
  { keywords: [], roles: ["Software Engineer"], locations: [], countries: ["Germany"], employmentTypes: ["Full-time"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], providers: [], postedWithinHours: 24, limit: 25 },
  { keywords: [], roles: ["Machine Learning Engineer"], locations: ["Munich"], countries: ["Germany"], employmentTypes: ["Full-time"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], providers: [], postedWithinHours: 168, limit: 25 },
  { keywords: [], roles: ["Data Scientist"], locations: [], countries: ["Germany"], employmentTypes: ["Working Student"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], providers: [], postedWithinHours: 168, limit: 25 },
  { keywords: [], roles: ["AI Engineer"], locations: [], countries: ["Germany"], employmentTypes: ["Internship"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], providers: [], postedWithinHours: 168, limit: 25 },
  { keywords: [], roles: ["Software Engineer"], locations: [], countries: ["Egypt"], employmentTypes: ["Full-time"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], providers: [], postedWithinHours: 168, limit: 25 },
];

const liveDescribe = process.env.RUN_LIVE_JOB_TESTS === "true" ? describe : describe.skip;

liveDescribe("live public job provider smoke test", () => {
  it("fetches real vacancies, normalizes valid URLs, and runs all required filters", async () => {
    const jobs = await arbeitnowProvider.search(scenarios[0], AbortSignal.timeout(15_000));
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs.slice(0, 25)) {
      expect(() => new URL(job.sourceUrl)).not.toThrow();
      expect(job.provider).toBe("arbeitnow");
      expect(job.title.length).toBeGreaterThan(0);
      expect(job.company.length).toBeGreaterThan(0);
    }
    for (const scenario of scenarios) {
      expect(() => jobs.filter((job) => jobMatchesQuery(job, scenario))).not.toThrow();
    }
  }, 20_000);
});
