import { z } from "zod";
import type { JobProvider } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";

const responseSchema = z.object({
  data: z.array(z.object({
    slug: z.string(),
    company_name: z.string(),
    title: z.string(),
    description: z.string().optional(),
    remote: z.boolean().default(false),
    url: z.string().url(),
    tags: z.array(z.string()).default([]),
    job_types: z.array(z.string()).default([]),
    location: z.string().optional(),
    created_at: z.number().int().positive(),
  })),
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
    return body.data.map((job) => normalizedJob({
      provider: "arbeitnow",
      externalId: job.slug,
      title: job.title,
      company: job.company_name,
      location: job.remote ? `${job.location || sourceCountry(job.url)} · Remote` : job.location,
      country: sourceCountry(job.url),
      description: job.description,
      employmentType: job.job_types[0],
      skills: job.tags,
      postedAt: new Date(job.created_at * 1_000).toISOString(),
      sourceUrl: job.url,
      applicationUrl: job.url,
      sourceDelayHours: 1,
      workplaceType: job.remote ? "remote" : undefined,
    }));
  },
};
