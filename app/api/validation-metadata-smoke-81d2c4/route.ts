import { searchJobs } from "@/src/lib/jobs/search";
import type { JobSearchQuery } from "@/src/types/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const baseQuery: JobSearchQuery = {
  keywords: [],
  roles: ["Software Engineer"],
  locations: [],
  countries: ["Germany"],
  employmentTypes: [],
  workplaceTypes: [],
  experienceLevels: [],
  companies: [],
  excludedCompanies: [],
  providers: [],
  postedWithinHours: 168,
  limit: 10,
};

async function sample(provider: string) {
  const result = await searchJobs({ ...baseQuery, providers: [provider] });
  return result.jobs.map((job) => ({
    provider: job.provider,
    title: job.title,
    company: job.company,
    location: job.location,
    country: job.country,
    postedAt: job.postedAt,
    sourceUrl: job.sourceUrl,
  }));
}

export async function GET() {
  try {
    const [linkedin, indeed] = await Promise.all([sample("linkedin"), sample("indeed")]);
    return Response.json({ testedAt: new Date().toISOString(), linkedin, indeed });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown validation error" }, { status: 500 });
  }
}
