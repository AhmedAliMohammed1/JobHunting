import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdzunaProvider } from "@/src/lib/jobs/providers/adzuna";
import { jobSearchSchema } from "@/src/lib/validation/search";

describe("Adzuna provider contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses country-aware official search and normalizes results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{
      id: "de-7", title: "Machine Learning Engineer", description: "Python and PyTorch",
      redirect_url: "https://www.adzuna.de/details/7", created: "2026-08-17T10:00:00Z",
      location: { display_name: "Berlin" }, company: { display_name: "Acme" },
      category: { label: "IT Jobs" }, contract_type: "permanent", contract_time: "full_time",
      salary_min: 70000, salary_max: 90000,
    }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createAdzunaProvider({ appId: "app-id", appKey: "app-key", countries: ["gb", "us"] });
    const jobs = await provider.search(jobSearchSchema.parse({ roles: ["Machine Learning Engineer"], countries: ["Germany"], postedWithinHours: 24 }));

    expect(jobs[0]).toMatchObject({ provider: "adzuna", externalId: "de:de-7", company: "Acme", country: "Germany", salaryMin: 70000, salaryMax: 90000 });
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.pathname).toContain("/de/search/1");
    expect(calledUrl.searchParams.get("max_days_old")).toBe("1");
  });
});
