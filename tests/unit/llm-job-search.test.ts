import { describe, expect, it } from "vitest";
import { buildLLMSearchQuery, hybridScore, type LLMSearchPlan } from "@/src/lib/ai/llm-job-search";
import type { JobSearchQuery, NormalizedJob } from "@/src/types/jobs";
import type { MatchResult } from "@/src/types/matching";

const base: JobSearchQuery = {
  roles: ["Embedded Software Engineer"], keywords: [], countries: ["Germany"], locations: [],
  providers: [], workplaceTypes: [], employmentTypes: [], experienceLevels: [], companies: [],
  excludedCompanies: [], postedWithinHours: 72, limit: 50,
};

const plan: LLMSearchPlan = {
  intentSummary: "Embedded and firmware software roles",
  roles: ["Firmware Engineer", "AUTOSAR Engineer", "Embedded Linux Engineer"],
  keywords: ["C++", "RTOS", "CAN"],
  searchAngles: ["embedded firmware", "automotive ECU software"],
};

describe("grounded LLM job search", () => {
  it("expands semantic roles while preserving hard filters", () => {
    const query = buildLLMSearchQuery(base, plan);
    expect(query.roles).toEqual(expect.arrayContaining(["Embedded Software Engineer", "Firmware Engineer", "AUTOSAR Engineer"]));
    expect(query.keywords).toEqual(expect.arrayContaining(["C++", "RTOS", "CAN"]));
    expect(query.countries).toEqual(["Germany"]);
    expect(query.postedWithinHours).toBe(72);
    expect(query.providers).toContain("linkedin");
  });

  it("keeps an explicitly selected source for the LLM pass", () => {
    const query = buildLLMSearchQuery({ ...base, providers: ["linkedin"] }, plan);
    expect(query.providers).toEqual(["linkedin"]);
  });

  it("blends deterministic CV fit with LLM relevance, freshness and source confidence", () => {
    const job: NormalizedJob = {
      id: "1", provider: "linkedin", sourceType: "search-discovery", title: "Embedded Software Engineer", company: "Example",
      workplaceType: "hybrid", skills: ["C++"], postedAt: new Date().toISOString(), firstDiscoveredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(), sourceUrl: "https://www.linkedin.com/jobs/view/123", status: "LIKELY_ACTIVE", freshnessLabel: "recently-refreshed",
    };
    const match: MatchResult = {
      score: 80, band: "Strong Match", breakdown: { semantic: 80, skills: 80, title: 90, experience: 50, location: 50, employment: 50, workplace: 50, recency: 100 },
      matchedSkills: ["C++"], missingSkills: [], reasons: ["Strong fit"],
    };
    const score = hybridScore(job, match, { id: "1", relevanceScore: 92, cvFitScore: 88, confidence: 90, reasons: [], matchedConcepts: [], concerns: [] });
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });
});
