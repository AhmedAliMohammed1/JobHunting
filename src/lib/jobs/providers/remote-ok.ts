import { z } from "zod";
import type { JobProvider } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";

const jobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  slug: z.string().optional(),
  epoch: z.number().optional(),
  date: z.string().optional(),
  company: z.string(),
  company_logo: z.string().optional(),
  position: z.string(),
  tags: z.array(z.string()).nullish().transform((value) => value ?? []),
  description: z.string().nullish(),
  location: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  url: z.string().url(),
  apply_url: z.string().url().optional(),
});

export const remoteOkProvider: JobProvider = {
  id: "remote-ok",
  name: "Remote OK official jobs feed",
  sourceType: "official-api",
  async search(_query, signal) {
    const response = await fetch("https://remoteok.com/api", {
      signal,
      headers: { Accept: "application/json", "User-Agent": "JobHunter-AI/1.0" },
      next: { revalidate: 3_600 },
    });
    if (!response.ok) throw new Error(`Remote OK returned ${response.status}`);
    const body = z.array(z.unknown()).parse(await response.json());
    const jobs = body.flatMap((row) => {
      const parsed = jobSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
    if (!jobs.length && body.length > 1) throw new Error("Remote OK returned no valid job rows");
    return jobs.map((job) => normalizedJob({
      provider: "remote-ok",
      externalId: job.id,
      title: job.position,
      company: job.company,
      companyLogo: job.company_logo || undefined,
      location: job.location || "Worldwide · Remote",
      description: job.description ?? undefined,
      skills: job.tags,
      postedAt: job.date ?? (job.epoch ? new Date(job.epoch * 1_000).toISOString() : undefined),
      salaryMin: job.salary_min || undefined,
      salaryMax: job.salary_max || undefined,
      sourceUrl: job.url,
      applicationUrl: job.apply_url ?? job.url,
      workplaceType: "remote",
      sourceDelayHours: 1,
    }));
  },
};
