import { describe, expect, it } from "vitest";
import { jobFingerprint } from "@/src/lib/jobs/persistence";
import type { NormalizedJob } from "@/src/types/jobs";

const job: NormalizedJob = { id: "1", externalId: "external-1", provider: "feed", title: "Engineer", company: "Acme", workplaceType: "remote", skills: [], firstDiscoveredAt: "2026-08-17T00:00:00.000Z", lastSeenAt: "2026-08-17T00:00:00.000Z", sourceUrl: "https://jobs.example/1", status: "ACTIVE", freshnessLabel: "live" };

describe("durable job identity", () => {
  it("is deterministic and changes with provider identity", () => {
    expect(jobFingerprint(job)).toBe(jobFingerprint({ ...job }));
    expect(jobFingerprint(job)).not.toBe(jobFingerprint({ ...job, provider: "another-feed" }));
  });
});
