import { afterEach, describe, expect, it, vi } from "vitest";
import { arbeitnowProvider } from "@/src/lib/jobs/providers/arbeitnow";
import { jobSearchSchema } from "@/src/lib/validation/search";

describe("Arbeitnow provider contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes attributed hourly listings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
      slug: "ml-engineer-berlin", company_name: "Acme", title: "Junior Machine Learning Engineer",
      description: "<p>Build NLP products with Python and PyTorch.</p>", remote: true,
      url: "https://www.arbeitnow.com/jobs/companies/acme/ml-engineer-berlin",
      tags: ["Machine Learning"], job_types: ["Full-time"], location: "Berlin", created_at: 1786989335,
    }, { slug: "malformed-row" }] }), { status: 200 })));
    const jobs = await arbeitnowProvider.search(jobSearchSchema.parse({ roles: ["Machine Learning Engineer"] }));
    expect(jobs[0]).toMatchObject({
      provider: "arbeitnow", company: "Acme", country: "Germany", workplaceType: "remote",
      employmentType: "Full-time", seniority: "Junior", freshnessLabel: "cached", sourceDelayHours: 1,
    });
    expect(jobs[0]?.skills).toEqual(expect.arrayContaining(["Python", "PyTorch", "Machine Learning"]));
    expect(jobs).toHaveLength(1);
  });

  it("accepts nullable optional arrays without failing the whole provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
      slug: "engineer", company_name: "Acme", title: "Software Engineer", remote: false,
      url: "https://www.arbeitnow.com/jobs/engineer", tags: null, job_types: null,
      location: null, description: null, created_at: 1786989335,
    }] }), { status: 200 })));
    const jobs = await arbeitnowProvider.search(jobSearchSchema.parse({ roles: ["Engineer"] }));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ provider: "arbeitnow", skills: [] });
  });

  it("surfaces upstream failures for partial-result handling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(arbeitnowProvider.search(jobSearchSchema.parse({ roles: ["Engineer"] }))).rejects.toThrow(/503/);
  });
});
