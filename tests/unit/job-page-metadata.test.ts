import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicJobPageMetadata } from "@/src/lib/jobs/job-page-metadata";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("public job page metadata", () => {
  it("extracts JobPosting title, company, location, country and date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<!doctype html><html><head><script type="application/ld+json">{
      "@context":"https://schema.org",
      "@type":"JobPosting",
      "title":"Software Engineer",
      "datePosted":"2026-08-18",
      "employmentType":"FULL_TIME",
      "hiringOrganization":{"@type":"Organization","name":"Example GmbH"},
      "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Berlin","addressCountry":"Germany"}},
      "description":"Build reliable backend services."
    }</script></head></html>`, { status: 200, headers: { "content-type": "text/html" } })));

    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/123")).resolves.toMatchObject({
      title: "Software Engineer",
      company: "Example GmbH",
      location: "Berlin, Germany",
      country: "Germany",
      datePosted: "2026-08-18",
      employmentType: "Full-time",
      description: "Build reliable backend services.",
    });
  });

  it("extracts a schema.org Country object instead of dropping it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<!doctype html><script type="application/ld+json">{
      "@context":"https://schema.org",
      "@type":"JobPosting",
      "title":"Embedded Software Engineer",
      "datePosted":"2026-08-18",
      "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"München","addressRegion":"Bayern","addressCountry":{"@type":"Country","name":"Germany"}}}
    }</script>`, { status: 200, headers: { "content-type": "text/html" } })));

    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/country-object")).resolves.toMatchObject({
      location: "München, Bayern, Germany",
      country: "Germany",
    });
  });

  it("uses applicantLocationRequirements for remote country metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<!doctype html><script type="application/ld+json">{
      "@context":"https://schema.org",
      "@type":"JobPosting",
      "title":"Firmware Engineer",
      "datePosted":"2026-08-18",
      "jobLocationType":"TELECOMMUTE",
      "applicantLocationRequirements":{"@type":"Country","name":"Germany"}
    }</script>`, { status: 200, headers: { "content-type": "text/html" } })));

    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/remote")).resolves.toMatchObject({ country: "Germany" });
  });

  it("extracts LinkedIn-style time, employment and seniority from visible page metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<!doctype html><html><head>
      <meta property="og:title" content="Embedded Developer C / System Integration Engineer | LinkedIn">
      </head><body>
      <time class="posted-time-ago__text" datetime="2026-08-14T12:00:00.000Z">4 days ago</time>
      <section>Seniority level <span>Entry level</span></section>
      <section>Employment type <span>Full-time</span></section>
      </body></html>`, { status: 200, headers: { "content-type": "text/html" } })));

    await expect(fetchPublicJobPageMetadata("https://linkedin.com/jobs/view/123")).resolves.toMatchObject({
      datePosted: "2026-08-14T12:00:00.000Z",
      employmentType: "Full-time",
      seniority: "Junior",
    });
  });

  it("finds a nested JobPosting object inside JSON-LD graphs and wrappers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<!doctype html><script type="application/ld+json">{
      "@context":"https://schema.org",
      "mainEntity":{"@type":"JobPosting","title":"Firmware Engineer","datePosted":"2026-08-17"}
    }</script>`, { status: 200, headers: { "content-type": "text/html" } })));
    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/nested")).resolves.toMatchObject({ title: "Firmware Engineer", datePosted: "2026-08-17" });
  });

  it("marks explicitly removed pages as dead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 410 })));
    await expect(fetchPublicJobPageMetadata("https://example.com/jobs/dead")).resolves.toEqual({ dead: true });
  });
});
