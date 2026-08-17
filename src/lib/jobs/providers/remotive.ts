import { z } from "zod";
import type { JobProvider } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";

const responseSchema = z.object({
  jobs: z.array(z.object({
    id: z.number(),
    url: z.string().url(),
    title: z.string(),
    company_name: z.string(),
    company_logo: z.string().url().optional().or(z.literal("")),
    category: z.string().optional(),
    job_type: z.string().optional(),
    publication_date: z.string().optional(),
    candidate_required_location: z.string().optional(),
    salary: z.string().optional(),
    description: z.string().optional(),
  })),
});

export const remotiveProvider: JobProvider = {
  id: "remotive",
  name: "Remotive public jobs API",
  sourceType: "official-api",
  async search(query, signal) {
    const search = [...query.roles, ...query.keywords].slice(0, 4).join(" ");
    const url = new URL("https://remotive.com/api/remote-jobs");
    if (search) url.searchParams.set("search", search);
    url.searchParams.set("limit", String(Math.min(query.limit, 50)));
    const response = await fetch(url, { signal, headers: { Accept: "application/json" }, next: { revalidate: 21_600 } });
    if (!response.ok) throw new Error(`Remotive returned ${response.status}`);
    const body = responseSchema.parse(await response.json());
    return body.jobs.map((job) => normalizedJob({
      provider: "remotive",
      externalId: String(job.id),
      title: job.title,
      company: job.company_name,
      companyLogo: job.company_logo || undefined,
      location: job.candidate_required_location,
      employmentType: job.job_type,
      salaryText: job.salary,
      description: job.description,
      postedAt: job.publication_date,
      sourceUrl: job.url,
      applicationUrl: job.url,
      sourceDelayHours: 24,
    }));
  },
};
