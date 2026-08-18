import { describe, expect, it } from "vitest";
import { inferDiscoveryMetadata, inferDiscoveryPostedAt } from "@/src/lib/jobs/discovery-metadata";
import { normalizedJob } from "@/src/lib/jobs/normalize";

const NOW = Date.parse("2026-08-18T02:00:00.000Z");

describe("search-discovery metadata enrichment", () => {
  it("extracts LinkedIn company, location and relative date from German indexed metadata", () => {
    const metadata = inferDiscoveryMetadata({
      provider: "linkedin",
      title: "Software Engineer, Platform - Berlin, Germany bei Speechify | LinkedIn",
      company: "Company not supplied",
      description: "Bewerben Sie sich für die Stelle als Software Engineer, Platform bei Speechify in Berlin. Position mit Vollzeit Berufseinstieg. 5 days ago",
      sourceUrl: "https://de.linkedin.com/jobs/view/software-engineer-platform-berlin-germany-at-speechify-4452676876",
      now: NOW,
    });

    expect(metadata.company).toBe("Speechify");
    expect(metadata.location).toBe("Berlin, Germany");
    expect(metadata.country).toBe("Germany");
    expect(metadata.postedAt).toBe("2026-08-13T02:00:00.000Z");
  });

  it("recovers a LinkedIn company from the detail URL and location/date from the snippet", () => {
    const metadata = inferDiscoveryMetadata({
      provider: "linkedin",
      title: "Software Engineer — Agent Guardrails | LinkedIn",
      company: "Company not supplied",
      description: "Get notified about new Software Engineer jobs in Germany. Sign in to create job alert. 2 hours ago",
      sourceUrl: "https://de.linkedin.com/jobs/view/software-engineer-%E2%80%94-agent-guardrails-at-european-tech-recruit-4453075923",
      now: NOW,
    });

    expect(metadata.company).toBe("European Tech Recruit");
    expect(metadata.location).toBe("Germany");
    expect(metadata.country).toBe("Germany");
    expect(metadata.postedAt).toBe("2026-08-18T00:00:00.000Z");
  });

  it("extracts Indeed company and location from the indexed snippet", () => {
    const metadata = inferDiscoveryMetadata({
      provider: "indeed",
      title: "Software Engineer, Platform - Berlin, Germany",
      company: "Company not supplied",
      description: "Software Engineer, Platform - Berlin, Germany. Speechify. Berlin. •. Homeoffice. Stellenbeschreibung. 1 day ago",
      sourceUrl: "https://de.indeed.com/viewjob?jk=9e2eb651b93dfbe4",
      now: NOW,
    });

    expect(metadata.company).toBe("Speechify");
    expect(metadata.location).toBe("Berlin, Germany");
    expect(metadata.country).toBe("Germany");
    expect(metadata.postedAt).toBe("2026-08-17T02:00:00.000Z");
  });

  it("handles Indeed company ownership/rating markup without confusing it for the location", () => {
    const metadata = inferDiscoveryMetadata({
      provider: "indeed",
      title: "Software Engineer- JMRC Germany Support - Hohenfels",
      company: "Company not supplied",
      description: "Software Engineer- JMRC Germany Support. General Dynamics Mission Systems, Inc. (gehört zu General Dynamics). ·. 3.6. Hohenfels. Stellenbeschreibung. Vor 3 Tagen",
      sourceUrl: "https://de.indeed.com/viewjob?jk=ada639c1a05996ae",
      now: NOW,
    });

    expect(metadata.company).toBe("General Dynamics Mission Systems, Inc");
    expect(metadata.location).toBe("Hohenfels");
    expect(metadata.postedAt).toBe("2026-08-15T02:00:00.000Z");
  });

  it("parses absolute indexed dates when a relative date is unavailable", () => {
    expect(inferDiscoveryPostedAt(undefined, "Software Engineer in Germany. Aug 6, 2026", NOW)).toBe("2026-08-06T00:00:00.000Z");
    expect(inferDiscoveryPostedAt(undefined, "Software Engineer in Deutschland. 17.08.2026", NOW)).toBe("2026-08-17T00:00:00.000Z");
  });

  it("applies enrichment only to search-discovery jobs and preserves explicit metadata", () => {
    const enriched = normalizedJob({
      provider: "indeed",
      sourceType: "search-discovery",
      externalId: "indeed-1",
      title: "Software Engineer, Platform - Berlin, Germany",
      company: "Company not supplied",
      description: "Software Engineer, Platform - Berlin, Germany. Speechify. Berlin. •. Homeoffice. Stellenbeschreibung. 1 day ago",
      sourceUrl: "https://de.indeed.com/viewjob?jk=9e2eb651b93dfbe4",
    });
    expect(enriched.company).toBe("Speechify");
    expect(enriched.location).toBe("Berlin, Germany");
    expect(enriched.country).toBe("Germany");
    expect(enriched.postedAt).toBeTruthy();

    const explicit = normalizedJob({
      provider: "indeed",
      sourceType: "search-discovery",
      externalId: "indeed-2",
      title: "Software Engineer",
      company: "Explicit Company",
      location: "Munich, Germany",
      postedAt: "2026-08-18T01:00:00.000Z",
      description: "Some unrelated indexed text.",
      sourceUrl: "https://de.indeed.com/viewjob?jk=abc123",
    });
    expect(explicit.company).toBe("Explicit Company");
    expect(explicit.location).toBe("Munich, Germany");
    expect(explicit.postedAt).toBe("2026-08-18T01:00:00.000Z");
  });
});
