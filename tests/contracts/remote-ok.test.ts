import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteOkProvider } from "@/src/lib/jobs/providers/remote-ok";
import { jobSearchSchema } from "@/src/lib/validation/search";

describe("Remote OK provider contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("skips feed metadata and returns attributed remote listings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { last_updated: 1786982438, legal: "Link back to Remote OK" },
      {
        id: "123", slug: "remote-engineer-acme-123", epoch: 1786892751,
        date: "2026-08-16T15:05:51+00:00", company: "Acme", company_logo: "",
        position: "Remote TypeScript Engineer", tags: ["typescript", "react"],
        description: "<p>Build React products.</p>", location: "Worldwide",
        salary_min: 90000, salary_max: 120000,
        url: "https://remoteok.com/remote-jobs/remote-engineer-acme-123",
        apply_url: "https://remoteok.com/remote-jobs/remote-engineer-acme-123",
      },
      { id: "malformed" },
    ]), { status: 200 })));

    const jobs = await remoteOkProvider.search(jobSearchSchema.parse({ roles: ["Engineer"] }));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      provider: "remote-ok", externalId: "123", company: "Acme", workplaceType: "remote",
      salaryMin: 90000, salaryMax: 120000, sourceDelayHours: 1,
      sourceUrl: "https://remoteok.com/remote-jobs/remote-engineer-acme-123",
    });
  });

  it("surfaces upstream failures for partial-result handling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    await expect(remoteOkProvider.search(jobSearchSchema.parse({ roles: ["Engineer"] }))).rejects.toThrow(/429/);
  });
});
