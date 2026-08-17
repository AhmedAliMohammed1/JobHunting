import { afterEach, describe, expect, it, vi } from "vitest";
import { createJoobleProvider } from "@/src/lib/jobs/providers/jooble";
import { jobSearchSchema } from "@/src/lib/validation/search";

describe("Jooble provider contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts structured search input and normalizes official API results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobs: [{
      id: 88, title: "Backend Engineer", location: "Munich", snippet: "Node.js and PostgreSQL",
      salary: "€70,000", source: "Acme careers", type: "Full-time",
      link: "https://de.jooble.org/desc/88", company: "Acme", updated: "2026-08-17T09:00:00Z",
    }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createJoobleProvider("private-api-key");
    const jobs = await provider.search(jobSearchSchema.parse({ roles: ["Backend Engineer"], locations: ["Munich"], limit: 100 }));

    expect(jobs[0]).toMatchObject({ provider: "jooble", externalId: "88", company: "Acme", location: "Munich" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ keywords: "Backend Engineer", location: "Munich", ResultOnPage: 50 });
  });
});
