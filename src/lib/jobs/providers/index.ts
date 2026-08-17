import { effectiveJobProviderMode, getServerEnv } from "@/src/config/env";
import type { JobProvider, JobSearchQuery } from "@/src/types/jobs";
import { arbeitnowProvider } from "./arbeitnow";
import { createAdzunaProvider } from "./adzuna";
import { createJoobleProvider } from "./jooble";
import { mockJobProvider } from "./mock";
import { remoteOkProvider } from "./remote-ok";
import { remotiveProvider } from "./remotive";

export function configuredJobProviders(query?: Pick<JobSearchQuery, "providers">): JobProvider[] {
  const env = getServerEnv();
  if (effectiveJobProviderMode(env) === "mock") return [mockJobProvider];
  const providers: JobProvider[] = [];
  if (env.ENABLE_ARBEITNOW === "true") providers.push(arbeitnowProvider);
  if (env.ENABLE_REMOTE_OK === "true") providers.push(remoteOkProvider);
  if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) providers.push(createAdzunaProvider({
    appId: env.ADZUNA_APP_ID,
    appKey: env.ADZUNA_APP_KEY,
    countries: env.ADZUNA_COUNTRIES.split(",").map((country) => country.trim().toLowerCase()).filter(Boolean),
  }));
  if (env.JOOBLE_API_KEY) providers.push(createJoobleProvider(env.JOOBLE_API_KEY));
  if (env.ENABLE_REMOTIVE === "true") providers.push(remotiveProvider);
  return query?.providers.length ? providers.filter((provider) => query.providers.includes(provider.id)) : providers;
}
