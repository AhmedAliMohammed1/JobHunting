import { afterEach, describe, expect, it, vi } from "vitest";
import { remotiveProvider } from "@/src/lib/jobs/providers/remotive";
import { jobSearchSchema } from "@/src/lib/validation/search";

describe("Remotive provider contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the external response into normalized cached jobs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobs: [{ id: 7, url: "https://remotive.com/remote-jobs/software-dev/role-7", title: "TypeScript Engineer", company_name: "Acme", company_logo: "", job_type: "full_time", publication_date: "2026-08-16T00:00:00Z", candidate_required_location: "Worldwide", salary: "$100k", description: "TypeScript React" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const jobs = await remotiveProvider.search(jobSearchSchema.parse({ roles: ["TypeScript Engineer"], limit: 100 }));
    expect(jobs[0]).toMatchObject({ provider: "remotive", externalId: "7", freshnessLabel: "cached", sourceDelayHours: 24, workplaceType: "unknown" });
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get("limit")).toBe("50"); expect(calledUrl.searchParams.get("search")).toBe("TypeScript Engineer");
  });

  it("surfaces provider failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(remotiveProvider.search(jobSearchSchema.parse({ roles: ["Engineer"] }))).rejects.toThrow(/503/);
  });
});
