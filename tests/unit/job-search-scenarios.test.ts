import { describe, expect, it } from "vitest";
import { interpretSearchQuery } from "@/src/lib/jobs/query-intent";

const cases = [
  ["Software Engineer Germany full-time last 24 hours", "Germany", "Full-time", 24],
  ["Machine Learning Engineer in Munich full-time last 7 days", undefined, "Full-time", 168],
  ["Data Scientist Germany Working Student last 7 days", "Germany", "Working Student", 168],
  ["AI Engineer Germany Internship last 7 days", "Germany", "Internship", 168],
  ["Software Engineer Egypt full-time last 7 days", "Egypt", "Full-time", 168],
] as const;

describe("required job-search scenarios", () => {
  for (const [input, country, employment, hours] of cases) {
    it(input, () => {
      const intent = interpretSearchQuery(input);
      if (country) expect(intent.countries).toContain(country);
      expect(intent.employmentTypes).toContain(employment);
      expect(intent.postedWithinHours).toBe(hours);
      expect(intent.roles?.length).toBeGreaterThan(0);
    });
  }

  it("understands German working-student terminology", () => {
    const intent = interpretSearchQuery("Werkstudent KI in München Deutschland letzte Woche");
    expect(intent.countries).toContain("Germany");
    expect(intent.locations).toContain("München");
    expect(intent.employmentTypes).toContain("Working Student");
    expect(intent.experienceLevels).toContain("Working student");
  });
});
