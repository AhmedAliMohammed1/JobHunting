import { describe, expect, it } from "vitest";
import { automationSettingsInputSchema, candidateProfileInputSchema, normalizedJobInputSchema, savedSearchInputSchema, splitList } from "@/src/lib/validation/product";

const validJob = {
  id: "provider-id", provider: "provider", title: "Software Engineer", company: "Acme", workplaceType: "remote", skills: ["TypeScript"], sourceUrl: "https://jobs.example/1", status: "ACTIVE", freshnessLabel: "live", firstDiscoveredAt: "2026-08-17T00:00:00.000Z", lastSeenAt: "2026-08-17T00:00:00.000Z",
};

describe("product input contracts", () => {
  it("normalizes comma-separated user lists", () => expect(splitList(" TypeScript, React, TypeScript, ")).toEqual(["TypeScript", "React"]));

  it("accepts a complete editable candidate profile", () => {
    const result = candidateProfileInputSchema.safeParse({ fullName: "Sam", skills: ["TypeScript"], preferredRoles: ["Engineer"], preferredCountries: [], preferredLocations: ["Remote"], employmentTypes: ["Full-time"], workplaceTypes: ["remote"], yearsExperience: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid salary ranges and unsafe URLs", () => {
    expect(normalizedJobInputSchema.safeParse({ ...validJob, salaryMin: 100, salaryMax: 50 }).success).toBe(false);
    expect(normalizedJobInputSchema.safeParse({ ...validJob, sourceUrl: "not-a-url" }).success).toBe(false);
  });

  it("enforces saved-search and automation hard limits", () => {
    const query = { keywords: ["TypeScript"], roles: [], locations: [], countries: [], employmentTypes: [], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], limit: 25 };
    expect(savedSearchInputSchema.safeParse({ name: "Daily search", query, enabled: true, schedule: "daily", minimumMatchScore: 75 }).success).toBe(true);
    expect(automationSettingsInputSchema.safeParse({ enabled: false, minimumMatch: 85, dailyLimit: 26, weeklyLimit: 50, companyDailyLimit: 2, maximumJobAgeHours: 72, companyWhitelist: [], companyBlacklist: [] }).success).toBe(false);
  });
});
