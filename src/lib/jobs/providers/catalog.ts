import type { ServerEnv } from "@/src/config/env";
import type { JobProviderCatalogEntry } from "@/src/types/jobs";
import { parseCareerSources } from "./career-sources";

export function jobProviderCatalog(env: ServerEnv): JobProviderCatalogEntry[] {
  const adzunaReady = Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);
  const joobleReady = Boolean(env.JOOBLE_API_KEY);
  const tavilyReady = Boolean(env.TAVILY_API_KEY);
  const braveReady = Boolean(env.BRAVE_SEARCH_API_KEY);
  const discoveryReady = tavilyReady || braveReady;
  const configuredAts = new Set<string>(parseCareerSources(env.JOB_CAREER_SOURCES_JSON).map((source) => source.provider === "successfactors" ? "sap-successfactors" : source.provider));

  const discoveryDetail = tavilyReady && braveReady
    ? "Tavily discovery enabled with Brave Search as an independent fallback for publicly indexed job pages."
    : tavilyReady
      ? "Tavily public-job discovery enabled. Add Brave Search for independent fallback coverage."
      : braveReady
        ? "Brave Search public-job discovery enabled."
        : "Public-job discovery is available when an optional search provider is configured.";

  const discoverySetup = discoveryReady ? undefined : "Optional: add TAVILY_API_KEY and/or BRAVE_SEARCH_API_KEY in Vercel.";

  const discoveryEntry = (id: string, name: string, coverage: JobProviderCatalogEntry["coverage"] = "global"): JobProviderCatalogEntry => ({
    id,
    name,
    availability: discoveryReady ? "discovery" : "optional",
    coverage,
    detail: discoveryDetail,
    setup: discoverySetup,
  });

  const atsEntry = (id: string, name: string, directRegistrySupported = true): JobProviderCatalogEntry => {
    const directReady = directRegistrySupported && configuredAts.has(id);
    const available = discoveryReady || directReady;
    return {
      id,
      name,
      availability: available ? "ats-discovery" : "optional",
      coverage: "company-specific",
      detail: directReady
        ? "Configured employer ATS boards are queried directly; public search discovery is used as a fallback when configured."
        : discoveryReady
          ? directRegistrySupported
            ? "ATS public-job discovery enabled; configured employer boards can also be queried directly."
            : "Publicly indexed employer postings are discovered through the configured search provider chain."
          : directRegistrySupported
            ? "Employer boards are optional; public ATS discovery becomes available with a search provider."
            : "This ATS requires public search discovery because tenant-specific endpoints are not treated as a global API.",
      setup: available ? undefined : directRegistrySupported ? "Optional: add TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, or configure JOB_CAREER_SOURCES_JSON." : "Optional: add TAVILY_API_KEY and/or BRAVE_SEARCH_API_KEY in Vercel.",
    };
  };

  return [
    {
      id: "arbeitnow", name: "Arbeitnow", availability: env.ENABLE_ARBEITNOW === "true" ? "active" : "optional", coverage: "regional",
      detail: env.ENABLE_ARBEITNOW === "true" ? "Official European jobs feed enabled." : "Optional public feed disabled by deployment configuration.",
      setup: env.ENABLE_ARBEITNOW === "true" ? undefined : "Set ENABLE_ARBEITNOW=true to enable it.",
    },
    {
      id: "remote-ok", name: "Remote OK", availability: env.ENABLE_REMOTE_OK === "true" ? "active" : "optional", coverage: "remote",
      detail: env.ENABLE_REMOTE_OK === "true" ? "Public remote-jobs feed enabled with source attribution." : "Optional remote feed disabled by deployment configuration.",
      setup: env.ENABLE_REMOTE_OK === "true" ? undefined : "Set ENABLE_REMOTE_OK=true to enable it.",
    },
    {
      id: "adzuna", name: "Adzuna", availability: adzunaReady ? "active" : "optional", coverage: "global",
      detail: adzunaReady ? "Official Adzuna API enabled." : "Optional official API not configured; other sources continue to work.",
      setup: adzunaReady ? undefined : "Optional: add ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel.",
    },
    {
      id: "jooble", name: "Jooble", availability: joobleReady ? "active" : "optional", coverage: "global",
      detail: joobleReady ? "Official Jooble API enabled." : "Optional official API not configured; other sources continue to work.",
      setup: joobleReady ? undefined : "Optional: add JOOBLE_API_KEY in Vercel.",
    },
    atsEntry("greenhouse", "Greenhouse"),
    atsEntry("lever", "Lever"),
    atsEntry("ashby", "Ashby"),
    atsEntry("smartrecruiters", "SmartRecruiters"),
    atsEntry("personio", "Personio"),
    atsEntry("workday", "Workday", false),
    atsEntry("sap-successfactors", "SAP SuccessFactors", false),
    discoveryEntry("linkedin", "LinkedIn"),
    discoveryEntry("indeed", "Indeed"),
    discoveryEntry("stepstone", "StepStone", "regional"),
    discoveryEntry("xing", "XING", "regional"),
    discoveryEntry("glassdoor", "Glassdoor"),
    discoveryEntry("career-page", "Company career pages"),
    {
      id: "remotive", name: "Remotive", availability: env.ENABLE_REMOTIVE === "true" ? "active" : "restricted", coverage: "remote",
      detail: env.ENABLE_REMOTIVE === "true" ? "Enabled by deployment configuration." : "Disabled unless current terms or separate permission allow this deployment use.",
      setup: env.ENABLE_REMOTIVE === "true" ? undefined : "Enable only after confirming permission for this use.",
    },
  ];
}
