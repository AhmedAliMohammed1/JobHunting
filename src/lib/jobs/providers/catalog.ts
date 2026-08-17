import type { ServerEnv } from "@/src/config/env";
import type { JobProviderCatalogEntry } from "@/src/types/jobs";
import { parseCareerSources } from "./career-sources";

export function jobProviderCatalog(env: ServerEnv): JobProviderCatalogEntry[] {
  const adzunaReady = Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);
  const joobleReady = Boolean(env.JOOBLE_API_KEY);
  const discoveryReady = Boolean(env.TAVILY_API_KEY);
  const configuredAts = new Set<string>(parseCareerSources(env.JOB_CAREER_SOURCES_JSON).map((source) => source.provider === "successfactors" ? "sap-successfactors" : source.provider));

  const discoveryEntry = (id: string, name: string, coverage: JobProviderCatalogEntry["coverage"] = "global"): JobProviderCatalogEntry => ({
    id,
    name,
    availability: discoveryReady ? "discovery" : "optional",
    coverage,
    detail: discoveryReady ? "Search discovery enabled for publicly indexed job pages." : "Public-job discovery is available when the optional search provider is configured.",
    setup: discoveryReady ? undefined : "Optional: add TAVILY_API_KEY in Vercel.",
  });

  const atsEntry = (id: string, name: string): JobProviderCatalogEntry => ({
    id,
    name,
    availability: discoveryReady || configuredAts.has(id) ? "ats-discovery" : "optional",
    coverage: "company-specific",
    detail: configuredAts.has(id)
      ? "Configured employer ATS boards are queried directly; public search discovery is used as a fallback."
      : discoveryReady
        ? "ATS public-job discovery enabled; configured employer boards can also be queried directly."
        : "Employer boards are optional; public ATS discovery becomes available with the search provider.",
    setup: discoveryReady || configuredAts.has(id) ? undefined : "Optional: add TAVILY_API_KEY or configure JOB_CAREER_SOURCES_JSON.",
  });

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
    atsEntry("workday", "Workday"),
    atsEntry("sap-successfactors", "SAP SuccessFactors"),
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
