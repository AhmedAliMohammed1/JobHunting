import { describe, expect, it } from "vitest";
import { scoreJobMatch } from "@/src/lib/matching/engine";
import { rankJobs } from "@/src/lib/matching/rank";
import { normalizedJob } from "@/src/lib/jobs/normalize";
import type { CandidateProfile } from "@/src/types/candidate";

const profile: CandidateProfile = { skills: [{ name: "TypeScript", source: "user" }, { name: "React", source: "user" }], programmingLanguages: [], frameworks: [], tools: [], certifications: [], languages: [], yearsExperience: 5, preferredRoles: ["Product Engineer"], preferredCountries: ["Germany"], preferredLocations: ["Berlin"], employmentTypes: ["Full-time"], workplaceTypes: ["hybrid"], manualFields: [] };

describe("matching", () => {
  it("is deterministic and exposes its factors", () => {
    const job = normalizedJob({ provider: "test", externalId: "1", title: "Product Engineer", company: "Acme", location: "Berlin, Germany · Hybrid", employmentType: "Full-time", description: "TypeScript React", postedAt: new Date().toISOString(), sourceUrl: "https://jobs.example.com/1" });
    const first = scoreJobMatch(profile, job, 0.9);
    const second = scoreJobMatch(profile, job, 0.9);
    expect(first).toEqual(second);
    expect(first.score).toBeGreaterThan(80);
    expect(first.breakdown.skills).toBe(100);
  });

  it("ranks stronger matches first", () => {
    const strong = normalizedJob({ provider: "test", externalId: "strong", title: "Product Engineer", company: "Acme", location: "Berlin, Germany · Hybrid", employmentType: "Full-time", description: "TypeScript React", postedAt: new Date().toISOString(), sourceUrl: "https://jobs.example.com/strong" });
    const weak = normalizedJob({ provider: "test", externalId: "weak", title: "Accountant", company: "Acme", location: "Elsewhere", description: "Excel", sourceUrl: "https://jobs.example.com/weak" });
    const ranked = rankJobs(profile, [weak, strong]);
    expect(ranked[0]?.job.id).toBe(strong.id);
    expect(ranked[0]?.match.score).toBeGreaterThan(ranked[1]?.match.score ?? 0);
  });
});
