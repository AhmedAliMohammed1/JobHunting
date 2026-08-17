import { log } from "@/src/lib/observability/logger";
import type { JobSearchQuery, NormalizedJob, ProviderSearchResult } from "@/src/types/jobs";
import { deduplicateJobs } from "./deduplicate";
import { withFreshness } from "./freshness";
import { configuredJobProviders } from "./providers";
import { withRetry } from "./retry";

export interface AggregatedSearchResult {
  jobs: NormalizedJob[];
  providers: ProviderSearchResult[];
  partial: boolean;
}

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N}+#.]+/gu, " ").replace(/\s+/g, " ").trim() ?? "";
}

function matchesSearchPhrases(job: NormalizedJob, phrases: string[]): boolean {
  if (!phrases.length) return true;
  const searchable = normalized([
    job.title,
    job.company,
    job.description,
    job.seniority,
    ...job.skills,
  ].filter(Boolean).join(" "));

  const padded = ` ${searchable} `;
  return phrases.some((phrase) => {
    const tokens = normalized(phrase).split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => padded.includes(` ${token} `));
  });
}

function matchesAny(value: string, candidates: string[]): boolean {
  return !candidates.length || candidates.some((candidate) => value.includes(normalized(candidate)));
}

export function jobMatchesQuery(job: NormalizedJob, query: JobSearchQuery, now = Date.now()): boolean {
  if (!matchesSearchPhrases(job, query.roles)) return false;
  if (!matchesSearchPhrases(job, query.keywords)) return false;

  const location = normalized(`${job.location ?? ""} ${job.country ?? ""}`);
  if (!matchesAny(location, query.locations)) return false;
  if (!matchesAny(normalized(`${job.country ?? ""} ${job.location ?? ""}`), query.countries)) return false;

  if (query.workplaceTypes.length && !query.workplaceTypes.includes(job.workplaceType)) return false;
  if (!matchesAny(normalized(job.employmentType), query.employmentTypes)) return false;
  if (!matchesAny(normalized(job.seniority), query.experienceLevels)) return false;
  if (!matchesAny(normalized(job.company), query.companies)) return false;
  if (query.excludedCompanies.some((company) => normalized(job.company).includes(normalized(company)))) return false;
  if (query.providers.length && !query.providers.includes(job.provider)) return false;

  if (query.postedWithinHours !== undefined) {
    const postedAt = job.postedAt ? Date.parse(job.postedAt) : Number.NaN;
    const oldestAllowed = now - query.postedWithinHours * 60 * 60 * 1_000;
    if (!Number.isFinite(postedAt) || postedAt < oldestAllowed || postedAt > now) return false;
  }

  if (query.minimumSalary !== undefined) {
    const highestKnownSalary = job.salaryMax ?? job.salaryMin;
    if (highestKnownSalary === undefined || highestKnownSalary < query.minimumSalary) return false;
  }

  return true;
}

export async function searchJobs(query: JobSearchQuery): Promise<AggregatedSearchResult> {
  const providers = configuredJobProviders(query);
  const settled = await Promise.allSettled(providers.map(async (provider): Promise<ProviderSearchResult> => {
    const started = Date.now();
    const jobs = await withRetry((signal) => provider.search(query, signal), { attempts: 2 });
    return {
      providerId: provider.id,
      jobs,
      health: { providerId: provider.id, ok: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), jobsReturned: jobs.length },
    };
  }));

  const results: ProviderSearchResult[] = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    log("warn", "job_provider_failed", { provider: providers[index]?.id, error: result.reason instanceof Error ? result.reason.name : "UnknownError" });
    return { providerId: providers[index]?.id ?? "unknown", jobs: [], health: { providerId: providers[index]?.id ?? "unknown", ok: false, latencyMs: 0, checkedAt: new Date().toISOString(), errorCode: "PROVIDER_UNAVAILABLE" } };
  });

  const now = Date.now();
  const filteredResults = results.map((result) => {
    const jobs = result.jobs.filter((job) => jobMatchesQuery(job, query, now));
    return { ...result, jobs, health: { ...result.health, jobsReturned: jobs.length } };
  });
  const jobs = deduplicateJobs(filteredResults.flatMap((result) => result.jobs)).map((job) => withFreshness(job)).slice(0, query.limit);
  return { jobs, providers: filteredResults, partial: settled.some((result) => result.status === "rejected") };
}
