import { afterEach, describe, expect, it } from "vitest";
import { GET as getConfig } from "@/app/api/config/status/route";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as search } from "@/app/api/jobs/search/route";

describe("public API integration", () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; delete process.env.TAVILY_API_KEY; });

  it("reports missing deployment dependencies without leaking secrets", async () => {
    const response = await getConfig(); const body = await response.json();
    expect(response.status).toBe(200); expect(body.services.auth).toBe(false);
    expect(JSON.stringify(body)).not.toContain("SUPABASE_SECRET_KEY");
    expect(body).not.toHaveProperty("environment");
    expect(body.providerCatalog.find((provider: { id: string }) => provider.id === "remote-ok")).toMatchObject({ availability: "active" });
    expect(body.providerCatalog.find((provider: { id: string }) => provider.id === "linkedin")).toMatchObject({ availability: "optional" });
  });

  it("returns a no-store health response", async () => {
    const response = await getHealth(); const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(body.components.application).toBe("ok");
  });

  it("searches providers and labels development fixtures", async () => {
    const response = await search(new Request("http://localhost/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "integration-suite" }, body: JSON.stringify({ query: "TypeScript engineer", filters: { limit: 25 } }) }));
    const body = await response.json();
    expect(response.status).toBe(200); expect(body.jobs.length).toBeGreaterThan(0); expect(body.disclosure).toMatch(/not live listings/i);
    expect(body.interpretedQuery).toMatchObject({ roles: ["Engineer"], keywords: ["TypeScript"] });
    expect(body.providers[0]).not.toHaveProperty("jobs");
  });

  it("returns a coarse validation error for malformed searches", async () => {
    const response = await search(new Request("http://localhost/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "invalid-suite" }, body: "{}" }));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "Check the search query and filters." });
  });
});
