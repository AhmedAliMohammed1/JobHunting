import { describe, expect, it } from "vitest";
import { deduplicateJobs } from "@/src/lib/jobs/deduplicate";
import { classifyFreshness } from "@/src/lib/jobs/freshness";
import { normalizedJob } from "@/src/lib/jobs/normalize";

function job(externalId: string, overrides: Partial<ReturnType<typeof normalizedJob>> = {}) {
  return { ...normalizedJob({ provider: "test", externalId, title: "Product Engineer", company: "Acme", location: "Berlin", sourceUrl: `https://jobs.example.com/${externalId}` }), ...overrides };
}

describe("job normalization", () => {
  it("creates stable identifiers and extracts skills", () => {
    const first = normalizedJob({ provider: "test", externalId: "42", title: "Frontend Engineer", company: "Acme", description: "React and TypeScript", sourceUrl: "https://jobs.example.com/42" });
    const second = normalizedJob({ provider: "test", externalId: "42", title: "Frontend Engineer", company: "Acme", sourceUrl: "https://jobs.example.com/42" });
    expect(first.id).toBe(second.id);
    expect(first.skills).toEqual(expect.arrayContaining(["TypeScript", "React"]));
  });

  it("deduplicates canonical company/title/location/source host", () => {
    expect(deduplicateJobs([job("1"), job("2")])).toHaveLength(1);
  });

  it("expires records that have not been verified in fourteen days", () => {
    const now = new Date("2026-08-17T12:00:00Z");
    expect(classifyFreshness(job("1", { lastVerifiedAt: "2026-07-01T12:00:00Z" }), now)).toBe("EXPIRED");
  });
});
