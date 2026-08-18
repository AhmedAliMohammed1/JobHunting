import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv } from "@/src/config/env";
import { jobProviderCatalog } from "@/src/lib/jobs/providers/catalog";

describe("job provider catalog", () => {
  afterEach(() => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    delete process.env.JOOBLE_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.SERPER_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.JOB_CAREER_SOURCES_JSON;
    delete process.env.ENABLE_REMOTE_OK;
  });

  it("treats missing optional credentials as non-fatal setup", () => {
    const catalog = jobProviderCatalog(getServerEnv());
    expect(catalog.find(({ id }) => id === "arbeitnow")?.availability).toBe("active");
    expect(catalog.find(({ id }) => id === "remote-ok")?.availability).toBe("active");
    expect(catalog.find(({ id }) => id === "adzuna")?.availability).toBe("optional");
    expect(catalog.find(({ id }) => id === "greenhouse")?.availability).toBe("optional");
    expect(catalog.find(({ id }) => id === "linkedin")?.availability).toBe("optional");
    expect(catalog.find(({ id }) => id === "remotive")?.availability).toBe("restricted");
  });

  it("marks Tavily plus Serper discovery enabled without exposing secrets", () => {
    process.env.TAVILY_API_KEY = "tvly-super-secret";
    process.env.SERPER_API_KEY = "serper-super-secret";
    process.env.ADZUNA_APP_ID = "app-id";
    process.env.ADZUNA_APP_KEY = "adzuna-secret";
    const catalog = jobProviderCatalog(getServerEnv());
    expect(catalog.find(({ id }) => id === "linkedin")?.availability).toBe("discovery");
    expect(catalog.find(({ id }) => id === "linkedin")?.detail).toContain("Serper Google Search");
    expect(catalog.find(({ id }) => id === "greenhouse")?.availability).toBe("ats-discovery");
    expect(catalog.find(({ id }) => id === "adzuna")?.availability).toBe("active");
    const serialized = JSON.stringify(catalog);
    expect(serialized).not.toContain("tvly-super-secret");
    expect(serialized).not.toContain("serper-super-secret");
    expect(serialized).not.toContain("adzuna-secret");
  });

  it("supports Serper as the only public discovery provider", () => {
    process.env.SERPER_API_KEY = "serper-only-secret";
    const catalog = jobProviderCatalog(getServerEnv());
    expect(catalog.find(({ id }) => id === "linkedin")?.availability).toBe("discovery");
    expect(catalog.find(({ id }) => id === "linkedin")?.detail).toContain("Serper Google Search public-job discovery enabled");
    expect(JSON.stringify(catalog)).not.toContain("serper-only-secret");
  });

  it("marks an employer ATS active through the central registry even without discovery", () => {
    process.env.JOB_CAREER_SOURCES_JSON = JSON.stringify([{ company: "Example", provider: "lever", identifier: "example" }]);
    const catalog = jobProviderCatalog(getServerEnv());
    expect(catalog.find(({ id }) => id === "lever")?.availability).toBe("ats-discovery");
  });
});
