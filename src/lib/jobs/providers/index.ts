import { effectiveJobProviderMode, getServerEnv } from "@/src/config/env";
import type { JobProvider, JobSearchQuery } from "@/src/types/jobs";
import { arbeitnowProvider } from "./arbeitnow";
import { createAdzunaProvider } from "./adzuna";
import { createBraveSearchProvider } from "./brave";
import { createJoobleProvider } from "./jooble";
import { mockJobProvider } from "./mock";
import { remoteOkProvider } from "./remote-ok";
import { remotiveProvider } from "./remotive";
import { createCareerRegistryProvider } from "./ats";
import { parseCareerSources } from "./career-sources";
import { createDiscoveryJobProvider, createTavilySearchProvider, DISCOVERY_SOURCE_IDS, type SearchDiscoveryProvider } from "./discovery";
import { createFallbackSearchDiscoveryProvider } from "./search-discovery-fallback";

const ATS_SOURCE_IDS = new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "personio", "workday", "sap-successfactors"]);

function providerSelected(provider: JobProvider, requested: string[]): boolean {
  if (!requested.length) return true;
  if (requested.includes(provider.id)) return true;
  if (provider.id === "web-discovery") return requested.some((id) => DISCOVERY_SOURCE_IDS.includes(id as (typeof DISCOVERY_SOURCE_IDS)[number]));
  if (provider.id === "ats-registry") return requested.some((id) => ATS_SOURCE_IDS.has(id));
  return false;
}

export function configuredJobProviders(query?: Pick<JobSearchQuery, "providers">): JobProvider[] {
  const env = getServerEnv();
  if (effectiveJobProviderMode(env) === "mock") return [mockJobProvider];
  const providers: JobProvider[] = [];
  const careerSources = parseCareerSources(env.JOB_CAREER_SOURCES_JSON);

  if (env.ENABLE_ARBEITNOW === "true") providers.push(arbeitnowProvider);
  if (env.ENABLE_REMOTE_OK === "true") providers.push(remoteOkProvider);
  if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) providers.push(createAdzunaProvider({
    appId: env.ADZUNA_APP_ID,
    appKey: env.ADZUNA_APP_KEY,
    countries: env.ADZUNA_COUNTRIES.split(",").map((country) => country.trim().toLowerCase()).filter(Boolean),
  }));
  if (env.JOOBLE_API_KEY) providers.push(createJoobleProvider(env.JOOBLE_API_KEY));
  if (careerSources.length) providers.push(createCareerRegistryProvider(careerSources));

  const discoveryProviders: SearchDiscoveryProvider[] = [];
  if (env.TAVILY_API_KEY) discoveryProviders.push(createTavilySearchProvider(env.TAVILY_API_KEY, env.SEARCH_DISCOVERY_CACHE_TTL_SECONDS));
  if (env.BRAVE_SEARCH_API_KEY) discoveryProviders.push(createBraveSearchProvider(env.BRAVE_SEARCH_API_KEY, env.SEARCH_DISCOVERY_CACHE_TTL_SECONDS));
  if (discoveryProviders.length) providers.push(createDiscoveryJobProvider(createFallbackSearchDiscoveryProvider(discoveryProviders)));

  if (env.ENABLE_REMOTIVE === "true") providers.push(remotiveProvider);

  const requested = query?.providers ?? [];
  return providers.filter((provider) => providerSelected(provider, requested));
}
