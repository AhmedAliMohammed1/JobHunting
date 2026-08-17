import { describe, expect, it } from "vitest";
import { parseSafeExternalUrl, requireHttpsUrl } from "@/src/lib/security/urls";

describe("external URL safety", () => {
  it("blocks local and credential-bearing URLs", () => {
    expect(parseSafeExternalUrl("http://localhost:3000/admin")).toBeNull();
    expect(parseSafeExternalUrl("https://user:password@example.com/apply")).toBeNull();
  });
  it("requires HTTPS for application URLs", () => {
    expect(() => requireHttpsUrl("http://jobs.example.com/apply")).toThrow();
    expect(requireHttpsUrl("https://jobs.example.com/apply").hostname).toBe("jobs.example.com");
  });
});
