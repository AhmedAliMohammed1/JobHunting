import { describe, expect, it } from "vitest";
import { canonicalDiscoveryJobUrl } from "@/src/lib/jobs/discovery-url";

describe("discovery job URL canonicalization", () => {
  it("converts LinkedIn indexed slugs to the stable numeric job URL", () => {
    expect(canonicalDiscoveryJobUrl("https://de.linkedin.com/jobs/view/software-engineer-at-example-4453075923?trackingId=x")?.url)
      .toBe("https://www.linkedin.com/jobs/view/4453075923");
  });

  it("keeps the Indeed jk identifier and removes unrelated tracking", () => {
    expect(canonicalDiscoveryJobUrl("https://de.indeed.com/viewjob?jk=ada639c1a05996ae&from=serp&vjs=3")?.url)
      .toBe("https://de.indeed.com/viewjob?jk=ada639c1a05996ae");
  });

  it("rejects transient Indeed redirect/ad URLs without a stable job key", () => {
    expect(canonicalDiscoveryJobUrl("https://de.indeed.com/rc/clk?cmp=Example&from=vj&pos=top"))
      .toBeUndefined();
    expect(canonicalDiscoveryJobUrl("https://de.indeed.com/pagead/clk?mo=r&ad=temporary"))
      .toBeUndefined();
  });
});
