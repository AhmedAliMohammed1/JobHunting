import type { ServerEnv } from "@/src/config/env";
import type { JobProviderCatalogEntry } from "@/src/types/jobs";

export function jobProviderCatalog(env: ServerEnv): JobProviderCatalogEntry[] {
  const adzunaReady = Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);
  const joobleReady = Boolean(env.JOOBLE_API_KEY);
  return [
    {
      id: "arbeitnow", name: "Arbeitnow", availability: env.ENABLE_ARBEITNOW === "true" ? "active" : "restricted", coverage: "regional",
      detail: env.ENABLE_ARBEITNOW === "true" ? "Enabled official European jobs feed." : "Disabled by deployment configuration.",
      setup: "Set ENABLE_ARBEITNOW=true.",
    },
    {
      id: "remote-ok", name: "Remote OK", availability: env.ENABLE_REMOTE_OK === "true" ? "active" : "restricted", coverage: "remote",
      detail: env.ENABLE_REMOTE_OK === "true" ? "Enabled official remote-jobs feed with source attribution." : "Disabled by deployment configuration.",
      setup: "Set ENABLE_REMOTE_OK=true.",
    },
    {
      id: "adzuna", name: "Adzuna", availability: adzunaReady ? "active" : "needs-api-key", coverage: "global",
      detail: adzunaReady ? "Connected to Adzuna's official multi-country search API." : "Official broad job search API; credentials are not configured.",
      setup: "Add ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel.",
    },
    {
      id: "jooble", name: "Jooble", availability: joobleReady ? "active" : "needs-api-key", coverage: "global",
      detail: joobleReady ? "Connected to Jooble's official job search API." : "Official broad job search API; an API key is not configured.",
      setup: "Add JOOBLE_API_KEY in Vercel.",
    },
    {
      id: "greenhouse", name: "Greenhouse", availability: "needs-company-board", coverage: "company-specific",
      detail: "Public jobs are available per employer board token, not through a global Greenhouse search.",
      setup: "Choose target employers and add their public board tokens.",
    },
    {
      id: "lever", name: "Lever", availability: "needs-company-board", coverage: "company-specific",
      detail: "Public jobs are available per employer site name, not through a global Lever search.",
      setup: "Choose target employers and add their Lever site names.",
    },
    {
      id: "ashby", name: "Ashby", availability: "needs-company-board", coverage: "company-specific",
      detail: "Public jobs are available per employer job-board name.",
      setup: "Choose target employers and add their Ashby board names.",
    },
    {
      id: "smartrecruiters", name: "SmartRecruiters", availability: "needs-company-board", coverage: "company-specific",
      detail: "Public postings require a company identifier; there is no global postings index.",
      setup: "Choose target employers and add their SmartRecruiters company identifiers.",
    },
    {
      id: "personio", name: "Personio", availability: "needs-company-board", coverage: "company-specific",
      detail: "Open positions are published through each employer's Personio XML career feed.",
      setup: "Choose target employers and add their Personio career-site hostnames.",
    },
    {
      id: "workday", name: "Workday", availability: "needs-company-board", coverage: "company-specific",
      detail: "Workday has tenant-specific career sites, not an approved global public search API.",
      setup: "A supported employer-by-employer connector is required.",
    },
    {
      id: "sap-successfactors", name: "SAP SuccessFactors", availability: "needs-company-board", coverage: "company-specific",
      detail: "Jobs are exposed through each employer's configured career site or approved integration.",
      setup: "A supported employer career-site integration is required.",
    },
    {
      id: "linkedin", name: "LinkedIn", availability: "partner-access", coverage: "global",
      detail: "LinkedIn does not provide an open general job-search API; Talent APIs require approved partner access.",
    },
    {
      id: "indeed", name: "Indeed", availability: "partner-access", coverage: "global",
      detail: "Indeed's official APIs are provisioned to approved partners and employers, not as an open search API.",
    },
    {
      id: "stepstone", name: "StepStone", availability: "partner-access", coverage: "regional",
      detail: "A licensed or approved partner feed is required for compliant aggregation.",
    },
    {
      id: "xing", name: "XING", availability: "partner-access", coverage: "regional",
      detail: "XING's recruiting API requires a customer contract and approved integration access.",
    },
    {
      id: "glassdoor", name: "Glassdoor", availability: "partner-access", coverage: "global",
      detail: "Current search access requires an approved commercial partnership; no open general search API is available.",
    },
    {
      id: "remotive", name: "Remotive", availability: "restricted", coverage: "remote",
      detail: "The public feed's current terms do not allow this login-gated use without separate permission.",
      setup: "Obtain written/private API permission before enabling it.",
    },
  ];
}
