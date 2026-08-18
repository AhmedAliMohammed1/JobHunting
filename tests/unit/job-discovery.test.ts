import { describe, expect, it } from "vitest";
import type { JobSearchQuery } from "@/src/types/jobs";
import { buildSearchQuery, createDiscoveryJobProvider, detectATS, isLikelyJobUrl, type SearchDiscoveryProvider } from "@/src/lib/jobs/providers/discovery";

function query(overrides: Partial<JobSearchQuery> = {}): JobSearchQuery {
  return {
    keywords: [], roles: ["Machine Learning Engineer"], locations: ["Munich"], countries: ["Germany"],
    employmentTypes: ["Full-time"], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [],
    providers: [], postedWithinHours: 168, limit: 20, ...overrides,
  };
}

describe("public job discovery", () => {
  it("builds Germany-friendly queries including German employment synonyms", () => {
    const built = buildSearchQuery({ source: "linkedin", roles: ["Data Scientist"], keywords: [], locations: ["Munich"], countries: ["Germany"], employmentTypes: ["Working Student"], workplaceTypes: [], companies: [] });
    expect(built).toContain('"Data Scientist"');
    expect(built).toContain('"Working Student"');
    expect(built).toContain('"Werkstudent"');
    expect(built).toContain('"Germany"');
  });

  it("detects ATS URLs and rejects non-job landing pages", () => {
    expect(detectATS("https://jobs.lever.co/example/abc")).toBe("lever");
    expect(detectATS("https://company.myworkdayjobs.com/en-US/careers/job/Berlin/Role_R123")).toBe("workday");
    expect(isLikelyJobUrl("https://www.linkedin.com/jobs/view/1234567890/")).toBe(true);
    expect(isLikelyJobUrl("https://www.linkedin.com/login")).toBe(false);
    expect(isLikelyJobUrl("https://example.com/careers")).toBe(false);
  });

  it("normalizes a publicly indexed LinkedIn job and keeps a canonical exact job URL", async () => {
    const linkedInUrl = "https://www.linkedin.com/jobs/view/4455296976/?trackingId=abc";
    const fake: SearchDiscoveryProvider = {
      id: "fake",
      async search() {
        return [{
          title: "Bosch hiring Machine Learning Engineer in Munich, Bavaria, Germany | LinkedIn",
          url: linkedInUrl,
          content: "Full-time hybrid Machine Learning Engineer role using Python and PyTorch.",
          score: 0.9,
          publishedDate: "2026-08-17T10:00:00Z",
        }];
      },
    };
    const provider = createDiscoveryJobProvider(fake);
    const jobs = await provider.search(query({ providers: ["linkedin"] }));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ provider: "linkedin", sourceType: "search-discovery", company: "Bosch", title: "Machine Learning Engineer", employmentType: "Full-time", workplaceType: "hybrid", sourceUrl: "https://www.linkedin.com/jobs/view/4455296976" });
  });

  it("keeps successful discovery groups when another group fails", async () => {
    let calls = 0;
    const flaky: SearchDiscoveryProvider = {
      id: "flaky",
      async search() {
        calls += 1;
        if (calls === 1) throw new Error("deliberate provider failure");
        return [{ title: "Software Engineer at Example", url: "https://jobs.lever.co/example/abc", content: "Full-time Software Engineer in Germany", score: 0.8 }];
      },
    };
    const provider = createDiscoveryJobProvider(flaky);
    const jobs = await provider.search(query({ roles: ["Software Engineer"], locations: [], providers: [] }));
    expect(jobs.some((job) => job.provider === "lever")).toBe(true);
  });
});
