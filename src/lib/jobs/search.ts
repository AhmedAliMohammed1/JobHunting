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

export async function searchJobs(query: JobSearchQuery): Promise<AggregatedSearchResult> {
  const providers = configuredJobProviders();
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

  const jobs = deduplicateJobs(results.flatMap((result) => result.jobs)).map((job) => withFreshness(job)).slice(0, query.limit);
  return { jobs, providers: results, partial: settled.some((result) => result.status === "rejected") };
}
