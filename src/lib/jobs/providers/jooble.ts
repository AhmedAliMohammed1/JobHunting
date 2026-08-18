import { z } from "zod";
import type { JobProvider } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";

const responseSchema = z.object({ jobs: z.array(z.unknown()) });
const jobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  location: z.string().nullish(),
  snippet: z.string().nullish(),
  salary: z.string().nullish(),
  source: z.string().nullish(),
  type: z.string().nullish(),
  link: z.string().url(),
  company: z.string().nullish(),
  updated: z.string().nullish(),
});

export function createJoobleProvider(apiKey: string): JobProvider {
  return {
    id: "jooble",
    name: "Jooble official jobs API",
    sourceType: "official-api",
    async search(query, signal) {
      const response = await fetch(`https://jooble.org/api/${encodeURIComponent(apiKey)}`, {
        method: "POST",
        signal,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [query.roles[0], ...query.keywords].filter(Boolean).slice(0, 4).join(" "),
          location: [...query.locations, ...query.countries].slice(0, 2).join(", "),
          salary: query.minimumSalary,
          page: 1,
          ResultOnPage: Math.min(query.limit, 50),
        }),
        next: { revalidate: 1_800 },
      });
      if (!response.ok) throw new Error(`Jooble returned ${response.status}`);
      const body = responseSchema.parse(await response.json());
      return body.jobs.flatMap((row) => {
        const parsed = jobSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      }).map((job) => normalizedJob({
        provider: "jooble",
        externalId: job.id,
        title: job.title,
        company: job.company ?? job.source ?? "Employer not supplied",
        location: job.location ?? undefined,
        description: job.snippet ?? undefined,
        employmentType: job.type ?? undefined,
        salaryText: job.salary ?? undefined,
        postedAt: job.updated ?? undefined,
        sourceUrl: job.link,
        applicationUrl: job.link,
        sourceDelayHours: 1,
      }));
    },
  };
}
