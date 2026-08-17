import { effectiveJobProviderMode, getServerEnv } from "@/src/config/env";
import type { JobProvider, JobSearchQuery } from "@/src/types/jobs";
import { arbeitnowProvider } from "./arbeitnow";
import { mockJobProvider } from "./mock";
import { remotiveProvider } from "./remotive";

export function configuredJobProviders(query?: Pick<JobSearchQuery, "providers">): JobProvider[] {
  const env = getServerEnv();
  if (effectiveJobProviderMode(env) === "mock") return [mockJobProvider];
  const providers: JobProvider[] = [];
  if (env.ENABLE_ARBEITNOW === "true") providers.push(arbeitnowProvider);
  if (env.ENABLE_REMOTIVE === "true") providers.push(remotiveProvider);
  return query?.providers.length ? providers.filter((provider) => query.providers.includes(provider.id)) : providers;
}
