import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv } from "@/src/config/env";
import { jobProviderCatalog } from "@/src/lib/jobs/providers/catalog";

describe("job provider catalog", () => {
  afterEach(() => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    delete process.env.JOOBLE_API_KEY;
    delete process.env.ENABLE_REMOTE_OK;
  });

  it("distinguishes active feeds from sources requiring access", () => {
    const catalog = jobProviderCatalog(getServerEnv());
    expect(catalog.find(({ id }) => id === "arbeitnow")?.availability).toBe("active");
    expect(catalog.find(({ id }) => id === "remote-ok")?.availability).toBe("active");
    expect(catalog.find(({ id }) => id === "adzuna")?.availability).toBe("needs-api-key");
    expect(catalog.find(({ id }) => id === "greenhouse")?.availability).toBe("needs-company-board");
    expect(catalog.find(({ id }) => id === "linkedin")?.availability).toBe("partner-access");
    expect(catalog.find(({ id }) => id === "remotive")?.availability).toBe("restricted");
  });

  it("marks credential-backed APIs active without exposing credential values", () => {
    process.env.ADZUNA_APP_ID = "app-id";
    process.env.ADZUNA_APP_KEY = "super-secret";
    process.env.JOOBLE_API_KEY = "another-secret";
    const serialized = JSON.stringify(jobProviderCatalog(getServerEnv()));
    expect(serialized).toContain('"availability":"active"');
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("another-secret");
  });
});
