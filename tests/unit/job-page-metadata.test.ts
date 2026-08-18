import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicJobPageMetadata } from "@/src/lib/jobs/job-page-metadata";

afterEach(() => vi.unstubAllGlobals());

describe("public job page metadata", () => {
  it("extracts JobPosting title, company, location and date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<!doctype html><html><head><script type="application/ld+json">{
      "@context":"https://schema.org",
      "@type":"JobPosting",
      "title":"Software Engineer",
      "datePosted":"2026-08-18",
      "hiringOrganization":{"@type":"Organization","name":"Example GmbH"},
      "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Berlin","addressCountry":"Germany"}},
      "description":"Build reliable backend services."
    }</script></head></html>`, { status: 200, headers: { "content-type": "text/html" } })));

    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/123")).resolves.toMatchObject({
      title: "Software Engineer",
      company: "Example GmbH",
      location: "Berlin, Germany",
      datePosted: "2026-08-18",
      description: "Build reliable backend services.",
    });
  });

  it("marks explicitly removed pages as dead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 410 })));
    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/dead")).resolves.toEqual({ dead: true });
  });
});
