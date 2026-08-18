import { describe, expect, it, vi } from "vitest";
import type { SearchDiscoveryProvider } from "@/src/lib/jobs/providers/discovery";
import { withDefaultDiscoveryRecency } from "@/src/lib/jobs/providers/search-discovery-reliability";

describe("search discovery reliability", () => {
  it("propagates the user's freshness window when a discovery strategy omits it", async () => {
    const search = vi.fn(async () => []);
    const provider: SearchDiscoveryProvider = { id: "test", search };
    const wrapped = withDefaultDiscoveryRecency(provider, 72);

    await wrapped.search("Embedded Software Engineer Germany", { maxResults: 12 });

    expect(search).toHaveBeenCalledWith(
      "Embedded Software Engineer Germany",
      expect.objectContaining({ postedWithinHours: 72, maxResults: 12 }),
      undefined,
    );
  });

  it("does not override a more specific discovery freshness option", async () => {
    const search = vi.fn(async () => []);
    const provider: SearchDiscoveryProvider = { id: "test", search };
    const wrapped = withDefaultDiscoveryRecency(provider, 72);

    await wrapped.search("Embedded Software Engineer Germany", { postedWithinHours: 24, maxResults: 12 });

    expect(search).toHaveBeenCalledWith(
      "Embedded Software Engineer Germany",
      expect.objectContaining({ postedWithinHours: 24 }),
      undefined,
    );
  });
});
