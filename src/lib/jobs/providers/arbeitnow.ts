import { z } from "zod";
import type { JobProvider } from "@/src/types/jobs";
import { inferWorkplaceType, normalizedJob } from "../normalize";

const responseSchema = z.object({ data: z.array(z.unknown()) });
const jobSchema = z.object({
  slug: z.string(),
  company_name: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  remote: z.boolean().nullish().transform((value) => value ?? false),
  url: z.string().url(),
  tags: z.array(z.string()).nullish().transform((value) => value ?? []),
  job_types: z.array(z.string()).nullish().transform((value) => value ?? []),
  location: z.string().nullish(),
  created_at: z.number().int().positive(),
});

function sourceCountry(url: string): string {
  return new URL(url).hostname.endsWith(".co.uk") ? "United Kingdom" : "Germany";
}

export const arbeitnowProvider: JobProvider = {
  id: "arbeitnow",
  name: "Arbeitnow European jobs API",
  sourceType: "approved-feed",
  async search(_query, signal) {
    const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 3_600 },
    });
    if (!response.ok) throw new Error(`Arbeitnow returned ${response.status}`);
    const body = responseSchema.parse(await response.json());
    const rows = body.data.flatMap((row) => {
      const parsed = jobSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
    if (!rows.length && body.data.length) throw new Error("Arbeitnow returned no valid job rows");
    return rows.map((job) => {
      const explicitWorkplace = inferWorkplaceType(job.location ?? undefined);
      const workplaceType = explicitWorkplace === "unknown" ? (job.remote ? "remote" : undefined) : explicitWorkplace;
      const location = workplaceType === "remote" && explicitWorkplace === "unknown"
        ? `${job.location || sourceCountry(job.url)} · Remote`
        : job.location ?? undefined;
      return normalizedJob({
        provider: "arbeitnow",
        externalId: job.slug,
        title: job.title,
        company: job.company_name,
        location,
        country: sourceCountry(job.url),
        description: job.description ?? undefined,
        employmentType: job.job_types[0],
        skills: job.tags,
        postedAt: new Date(job.created_at * 1_000).toISOString(),
        sourceUrl: job.url,
        applicationUrl: job.url,
        sourceDelayHours: 1,
        workplaceType,
      });
    });
  },
};
