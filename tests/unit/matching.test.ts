import { describe, expect, it } from "vitest";
import { scoreJobMatch } from "@/src/lib/matching/engine";
import { rankJobs } from "@/src/lib/matching/rank";
import { deriveCandidateSearchRoles } from "@/src/lib/matching/role-inference";
import { normalizedJob } from "@/src/lib/jobs/normalize";
import type { CandidateProfile } from "@/src/types/candidate";

const profile: CandidateProfile = { skills: [{ name: "TypeScript", source: "user" }, { name: "React", source: "user" }], programmingLanguages: [], frameworks: [], tools: [], certifications: [], languages: [], yearsExperience: 5, preferredRoles: ["Product Engineer"], preferredCountries: ["Germany"], preferredLocations: ["Berlin"], employmentTypes: ["Full-time"], workplaceTypes: ["hybrid"], manualFields: [] };

const cvProfile: CandidateProfile = {
  currentTitle: "Automotive Engineering M.Eng. student",
  summary: "Software Test Engineer working with automated GUI tests, embedded systems, sensor validation and automotive system validation.",
  skills: [
    { name: "Embedded C", source: "cv" },
    { name: "C++", source: "cv" },
    { name: "Sensor Validation", source: "cv" },
    { name: "Regression Testing", source: "cv" },
  ],
  programmingLanguages: ["C", "C++", "Python"],
  frameworks: ["FreeRTOS", "ROS 2"],
  tools: ["Squish", "CANoe", "Git", "Docker"],
  certifications: [],
  languages: [{ name: "English", level: "Fluent" }],
  preferredRoles: [],
  preferredCountries: [],
  preferredLocations: [],
  employmentTypes: [],
  workplaceTypes: [],
  manualFields: [],
};

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

  it("derives useful search roles when the user has not set target roles", () => {
    const roles = deriveCandidateSearchRoles(cvProfile);
    expect(roles).toContain("Software Test Engineer");
    expect(roles).toContain("Test Automation Engineer");
    expect(roles).toContain("Embedded Software Engineer");
    expect(roles).toContain("Automotive Software Engineer");
  });

  it("uses CV context and embedded skills to rank a suitable role above an unrelated role", () => {
    const strong = normalizedJob({
      provider: "test",
      externalId: "embedded-test",
      title: "Embedded Software Test Engineer",
      company: "Mobility Labs",
      description: "Develop Python and Squish test automation for embedded C++ software. Validate CAN communication with CANoe and run regression testing on automotive systems.",
      postedAt: new Date().toISOString(),
      sourceUrl: "https://jobs.example.com/embedded-test",
    });
    const weak = normalizedJob({
      provider: "test",
      externalId: "finance",
      title: "Financial Controller",
      company: "Ledger Corp",
      description: "Accounting, financial reporting and tax compliance.",
      postedAt: new Date().toISOString(),
      sourceUrl: "https://jobs.example.com/finance",
    });
    const ranked = rankJobs(cvProfile, [weak, strong]);
    expect(ranked[0]?.job.id).toBe(strong.id);
    expect(ranked[0]?.match.score).toBeGreaterThan(70);
    expect(ranked[0]?.match.matchedSkills).toEqual(expect.arrayContaining(["Python", "C++", "Squish", "CANoe"]));
    expect(ranked[0]?.match.reasons.some((reason) => reason.includes("CV"))).toBe(true);
  });
});
