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

const PRIORITY_JOB_SOURCES = new Map<string, number>([
  ["linkedin", 1],
  ["indeed", 0.98],
  ["xing", 0.96],
]);

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N}+#.]+/gu, " ").replace(/\s+/g, " ").trim() ?? "";
}

function matchesSearchPhrases(searchableValue: string, phrases: string[]): boolean {
  if (!phrases.length) return true;
  const searchable = normalized(searchableValue);
  const padded = ` ${searchable} `;
  return phrases.some((phrase) => {
    const tokens = normalized(phrase).split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => padded.includes(` ${token} `));
  });
}

function matchesAny(value: string, candidates: string[]): boolean {
  return !candidates.length || candidates.some((candidate) => value.includes(normalized(candidate)));
}

function discoveryUnknown(job: NormalizedJob, value: string | undefined): boolean {
  return job.sourceType === "search-discovery" && !normalized(value);
}

export function jobMatchesQuery(job: NormalizedJob, query: JobSearchQuery, now = Date.now()): boolean {
  if (!matchesSearchPhrases(`${job.title} ${job.seniority ?? ""}`, query.roles)) return false;
  if (!matchesSearchPhrases([job.title, job.company, job.description, ...job.skills].filter(Boolean).join(" "), query.keywords)) return false;

  const location = normalized(`${job.location ?? ""} ${job.city ?? ""} ${job.country ?? ""}`);
  if (query.locations.length && !location && job.sourceType !== "search-discovery") return false;
  if (location && !matchesAny(location, query.locations)) return false;
  const country = normalized(`${job.country ?? ""} ${job.location ?? ""}`);
  if (query.countries.length && !country && job.sourceType !== "search-discovery") return false;
  if (country && !matchesAny(country, query.countries)) return false;

  if (query.workplaceTypes.length && !(job.workplaceType === "unknown" && job.sourceType === "search-discovery") && !query.workplaceTypes.includes(job.workplaceType)) return false;
  if (!discoveryUnknown(job, job.employmentType) && !matchesAny(normalized(job.employmentType), query.employmentTypes)) return false;
  if (!discoveryUnknown(job, job.seniority) && !matchesAny(normalized(job.seniority), query.experienceLevels)) return false;
  const companyKnown = !/^(?:company not supplied|unknown company)$/i.test(job.company);
  if (query.companies.length && companyKnown && !matchesAny(normalized(job.company), query.companies)) return false;
  if (query.companies.length && !companyKnown && job.sourceType !== "search-discovery") return false;
  if (query.excludedCompanies.some((company) => normalized(job.company).includes(normalized(company)))) return false;
  if (query.providers.length && !query.providers.includes(job.provider)) return false;

  if (query.postedWithinHours !== undefined) {
    const postedAt = job.postedAt ? Date.parse(job.postedAt) : Number.NaN;
    const oldestAllowed = now - query.postedWithinHours * 60 * 60 * 1_000;
    if (!Number.isFinite(postedAt)) {
      if (job.sourceType !== "search-discovery") return false;
    } else if (postedAt < oldestAllowed || postedAt > now) return false;
  }

  if (query.minimumSalary !== undefined) {
    const highestKnownSalary = job.salaryMax ?? job.salaryMin;
    if (highestKnownSalary === undefined || highestKnownSalary < query.minimumSalary) return false;
  }

  return true;
}

function lexicalScore(job: NormalizedJob, query: JobSearchQuery): number {
  const terms = [...query.roles, ...query.keywords].flatMap((value) => normalized(value).split(" ")).filter(Boolean);
  if (!terms.length) return 0.5;
  const haystack = normalized(`${job.title} ${job.company} ${job.description ?? ""}`);
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

function recencyScore(job: NormalizedJob): number {
  if (!job.postedAt) return 0.35;
  const hours = Math.max(0, (Date.now() - Date.parse(job.postedAt)) / 3_600_000);
  if (!Number.isFinite(hours)) return 0.35;
  if (hours <= 24) return 1;
  if (hours <= 72) return 0.85;
  if (hours <= 168) return 0.7;
  if (hours <= 336) return 0.5;
  if (hours <= 720) return 0.3;
  return 0.1;
}

function sourceQuality(job: NormalizedJob): number {
  switch (job.sourceType) {
    case "official-api": return 1;
    case "public-ats": return 0.9;
    case "career-page": return 0.8;
    case "approved-feed": return 0.75;
    case "search-discovery": return 0.6;
    default: return 0.4;
  }
}

export function providerPriority(job: Pick<NormalizedJob, "provider">): number {
  return PRIORITY_JOB_SOURCES.get(job.provider.toLowerCase()) ?? 0.35;
}

export function rankWithoutProfile(jobs: NormalizedJob[], query: JobSearchQuery): NormalizedJob[] {
  return [...jobs].sort((a, b) => {
    // LinkedIn, Indeed and XING are deliberately favored for fresh-job discovery.
    // Relevance and recency remain the majority of the score so unrelated jobs
    // from a priority source cannot outrank a clearly matching role.
    const score = (job: NormalizedJob) =>
      0.45 * lexicalScore(job, query)
      + 0.25 * recencyScore(job)
      + 0.25 * providerPriority(job)
      + 0.05 * sourceQuality(job);
    return score(b) - score(a);
  });
}

export async function searchJobs(query: JobSearchQuery): Promise<AggregatedSearchResult> {
  const providers = configuredJobProviders(query);
  const settled = await Promise.allSettled(providers.map(async (provider): Promise<ProviderSearchResult> => {
    const started = Date.now();
    const jobs = await withRetry((signal) => provider.search(query, signal), { attempts: 1, timeoutMs: 8_000 });
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
  const deduplicated = deduplicateJobs(filteredResults.flatMap((result) => result.jobs)).map((job) => withFreshness(job));
  const jobs = rankWithoutProfile(deduplicated, query).slice(0, query.limit);
  return { jobs, providers: filteredResults, partial: settled.some((result) => result.status === "rejected") };
}
