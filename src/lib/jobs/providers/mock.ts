import type { JobProvider, JobSearchQuery, NormalizedJob } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";

const MOCK_ROWS = [
  ["101", "Senior Frontend Engineer", "Northstar Systems", "Berlin, Germany · Remote", "TypeScript React Next.js GraphQL", "€85k–€110k", "Full-time"],
  ["102", "Product Engineer", "Arc & Field", "London, UK · Hybrid", "TypeScript React Node.js PostgreSQL", "£75k–£95k", "Full-time"],
  ["103", "Full Stack Engineer", "Tandem Health", "Europe · Remote", "React Node.js AWS Docker PostgreSQL", "$90k–$125k", "Full-time"],
] as const;

export const mockJobProvider: JobProvider = {
  id: "mock",
  name: "Local development fixtures",
  sourceType: "mock",
  async search(query: JobSearchQuery): Promise<NormalizedJob[]> {
    const needle = [...query.keywords, ...query.roles].join(" ").toLowerCase();
    return MOCK_ROWS.map(([id, title, company, location, description, salary, employmentType]) =>
      normalizedJob({
        provider: "mock",
        externalId: id,
        title,
        company,
        location,
        description,
        employmentType,
        salaryText: salary,
        sourceUrl: `https://example.invalid/jobs/${id}`,
        applicationUrl: `https://example.invalid/jobs/${id}/apply`,
        postedAt: new Date(Date.now() - Number(id) % 4 * 86_400_000).toISOString(),
      }),
    ).filter((job) => !needle || `${job.title} ${job.description}`.toLowerCase().includes(needle.split(" ")[0])).slice(0, query.limit);
  },
};
