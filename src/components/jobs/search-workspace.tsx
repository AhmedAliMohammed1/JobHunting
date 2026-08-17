"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Search, SlidersHorizontal } from "lucide-react";
import type { JobProviderCatalogEntry, JobSearchQuery, NormalizedJob, ProviderHealth, WorkplaceType } from "@/src/types/jobs";
import type { MatchResult } from "@/src/types/matching";
import { SaveJobButton } from "./save-job-button";
import { splitList } from "@/src/lib/validation/product";

const subscribeToHydration = () => () => {};

type SearchJob = NormalizedJob & { match?: MatchResult };
type SearchResponse = {
  jobs: SearchJob[];
  providers: ProviderHealth[];
  partial: boolean;
  interpretedQuery: JobSearchQuery;
  warnings?: string[];
  disclosure?: string;
  error?: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  arbeitnow: "Arbeitnow",
  "remote-ok": "Remote OK",
  adzuna: "Adzuna",
  jooble: "Jooble",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  personio: "Personio",
  workday: "Workday",
  "sap-successfactors": "SAP SuccessFactors",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  stepstone: "StepStone",
  xing: "XING",
  glassdoor: "Glassdoor",
  "career-page": "Company career page",
  "web-discovery": "Public job discovery",
  "ats-registry": "Configured ATS boards",
  remotive: "Remotive",
  mock: "Development fixture",
};

const AVAILABILITY_LABELS: Record<JobProviderCatalogEntry["availability"], string> = {
  active: "Enabled",
  optional: "Optional source",
  discovery: "Search discovery enabled",
  "ats-discovery": "ATS + discovery enabled",
  restricted: "Disabled by policy/config",
};

function optionalNumber(value: string): number | undefined {
  return value ? Number(value) : undefined;
}

function queryChips(query: JobSearchQuery | undefined): string[] {
  if (!query) return [];
  return [
    ...query.roles.slice(0, 4),
    ...query.keywords.slice(0, 3),
    ...query.locations,
    ...query.countries,
    ...query.experienceLevels.slice(0, 2),
    ...query.employmentTypes,
    ...query.workplaceTypes,
    query.postedWithinHours ? `Past ${query.postedWithinHours}h` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function postedLabel(postedAt: string | undefined): string {
  if (!postedAt) return "Posting date unavailable";
  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp)) return "Posting date unavailable";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return "Posted recently";
  if (hours < 24) return `Posted ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Posted ${days}d ago`;
}

export function SearchWorkspace() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const requestSequence = useRef(0);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<JobProviderCatalogEntry[]>([]);
  const [interpretedQuery, setInterpretedQuery] = useState<JobSearchQuery>();
  const [notice, setNotice] = useState("Search recent vacancies across APIs, ATS boards, and public job discovery.");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [employment, setEmployment] = useState("");
  const [experience, setExperience] = useState("");
  const [postedWithin, setPostedWithin] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [minimumMatch, setMinimumMatch] = useState("");
  const [savedSearchMessage, setSavedSearchMessage] = useState("");

  useEffect(() => {
    void fetch("/api/config/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load search source status.");
        return response.json() as Promise<{ providerCatalog?: JobProviderCatalogEntry[] }>;
      })
      .then((status) => setProviderCatalog(status.providerCatalog ?? []))
      .catch(() => setProviderCatalog([]));
  }, []);

  function filters() {
    return {
      limit: 50,
      locations: splitList(location),
      countries: splitList(country),
      workplaceTypes: workplace ? [workplace as WorkplaceType] : undefined,
      employmentTypes: employment ? [employment] : undefined,
      experienceLevels: experience ? [experience] : undefined,
      companies: splitList(company),
      providers: source ? [source] : undefined,
      postedWithinHours: optionalNumber(postedWithin),
      minimumSalary: optionalNumber(minimumSalary),
      minimumMatchScore: optionalNumber(minimumMatch),
    };
  }

  async function search() {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setSavedSearchMessage("");
    setWarnings([]);
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() || undefined, filters: filters() }),
      });
      const body = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(body.error ?? "Search failed");
      if (sequence !== requestSequence.current) return;
      setJobs(body.jobs);
      setProviders(body.providers);
      setInterpretedQuery(body.interpretedQuery);
      setWarnings(body.warnings ?? []);
      setSearched(true);
      setNotice(body.partial ? `${body.disclosure ?? "Search completed."} Some optional sources were unavailable.` : body.disclosure ?? `${body.jobs.length} roles returned.`);
    } catch (error) {
      if (sequence === requestSequence.current) {
        setSearched(true);
        setJobs([]);
        setProviders([]);
        setNotice(error instanceof Error ? error.message : "Search failed");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  async function saveSearch() {
    if (!interpretedQuery) { setSavedSearchMessage("Run the search first so its interpreted filters can be saved."); return; }
    const searchName = query.trim().slice(0, 120) || queryChips(interpretedQuery).slice(0, 3).join(" · ");
    const response = await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: searchName || "Filtered job search", enabled: true, schedule: "daily", minimumMatchScore: interpretedQuery.minimumMatchScore ?? 75, query: interpretedQuery }),
    });
    const body = await response.json() as { error?: string };
    setSavedSearchMessage(response.ok ? "Search saved with all interpreted filters and scheduled daily." : body.error ?? "Could not save search.");
  }

  const failedProviders = providers.filter((provider) => !provider.ok).length;
  const chips = queryChips(interpretedQuery);
  const selectableSources = providerCatalog.filter((provider) => ["active", "discovery", "ats-discovery"].includes(provider.availability) && provider.id !== "mock");
  const enabledSourceCount = selectableSources.length;

  return <div className="search-workspace">
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <Search size={20} />
      <input aria-label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} disabled={!hydrated} placeholder="e.g. Machine Learning Engineer in Munich, full-time, last 7 days" />
      <button type="submit" disabled={!hydrated || loading}>{loading ? "Searching sources…" : "Search"}</button>
    </form>
    <div className="search-toolbar">
      <button className="text-button" type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} disabled={!hydrated}><SlidersHorizontal size={16} /> Filters</button>
      <strong role="status">{notice}</strong>
      <button className="secondary-button" type="button" onClick={() => void saveSearch()} disabled={!hydrated || loading}>Save search</button>
    </div>
    {filtersOpen ? <div className="filter-panel">
      <label>Locations<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Berlin, Munich, Cairo" /></label>
      <label>Countries<input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Germany, Egypt" /></label>
      <label>Workplace<select value={workplace} onChange={(event) => setWorkplace(event.target.value)}><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
      <label>Employment type<select value={employment} onChange={(event) => setEmployment(event.target.value)}><option value="">Any</option><option value="Full-time">Full-time</option><option value="Part-time">Part-time</option><option value="Internship">Internship</option><option value="Working Student">Working Student</option><option value="Contract">Contract</option><option value="Freelance">Freelance</option></select></label>
      <label>Experience<select value={experience} onChange={(event) => setExperience(event.target.value)}><option value="">Any</option><option value="Internship">Internship</option><option value="Working student">Working Student</option><option value="Junior">Junior / entry level</option><option value="Mid level">Mid level</option><option value="Senior">Senior</option><option value="Lead">Lead / staff</option></select></label>
      <label>Date posted<select value={postedWithin} onChange={(event) => setPostedWithin(event.target.value)}><option value="">Any time</option><option value="24">Last 24 hours</option><option value="72">Last 3 days</option><option value="168">Last 7 days</option><option value="336">Last 14 days</option><option value="720">Last 30 days</option></select></label>
      <label>Company<input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company names" /></label>
      <label>Source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">All enabled sources</option>{selectableSources.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}</select></label>
      <label>Minimum salary<input type="number" min="0" step="1000" value={minimumSalary} onChange={(event) => setMinimumSalary(event.target.value)} placeholder="60000" /></label>
      <label>Minimum CV match<select value={minimumMatch} onChange={(event) => setMinimumMatch(event.target.value)}><option value="">Any</option><option value="60">60%</option><option value="70">70%</option><option value="80">80%</option><option value="90">90%</option></select></label>
    </div> : null}
    {providerCatalog.length ? <details className="provider-catalog">
      <summary>Search sources: {enabledSourceCount} enabled · optional sources never block search</summary>
      <p>Official APIs and public ATS feeds are preferred. When a site has no open global Jobs API, the server can discover publicly indexed job pages through the configured search provider without logging in, bypassing CAPTCHAs, or using private endpoints.</p>
      <div className="provider-catalog-grid">
        {providerCatalog.map((provider) => <article key={provider.id}>
          <div><strong>{provider.name}</strong><span className={`provider-state provider-state-${provider.availability}`}>{AVAILABILITY_LABELS[provider.availability]}</span></div>
          <p>{provider.detail}</p>
          {provider.setup ? <small>{provider.setup}</small> : null}
        </article>)}
      </div>
    </details> : null}
    {chips.length ? <div className="interpreted-query" aria-label="Interpreted search filters"><strong>Understood as</strong>{chips.map((chip) => <span key={chip}>{chip}</span>)}</div> : null}
    {providers.length ? <p className="provider-summary">{providers.length} provider pipeline{providers.length === 1 ? "" : "s"} searched · {providers.reduce((total, provider) => total + (provider.jobsReturned ?? 0), 0)} matching rows before deduplication{failedProviders ? ` · ${failedProviders} optional provider${failedProviders === 1 ? "" : "s"} unavailable` : ""}</p> : null}
    {warnings.map((warning) => <p className="search-warning" key={warning}><AlertTriangle size={15} />{warning}</p>)}
    {savedSearchMessage ? <p className="form-status" role="status">{savedSearchMessage}</p> : null}
    <div className="search-results" aria-live="polite" aria-busy={loading}>
      {loading ? Array.from({ length: 3 }, (_, index) => <div className="result-card search-skeleton" key={index}><div /><span /></div>) : null}
      {!loading && jobs.map((job) => <article className="result-card" key={job.id}>
        {job.match ? <strong className="match-score" aria-label={`${job.match.score}% CV match`}>{job.match.score}%</strong> : null}
        <div>
          <span className="source-label">{job.provider === "mock" ? "DEVELOPMENT FIXTURE" : `${PROVIDER_LABELS[job.provider] ?? job.provider} · ${job.freshnessLabel}`}</span>
          <h2>{job.title}</h2>
          <p>{job.company} · {job.location ?? job.city ?? job.country ?? "Location not supplied"}</p>
          <small>{postedLabel(job.postedAt)}</small>
          <div className="tag-row">{[job.employmentType, job.seniority, job.workplaceType !== "unknown" ? job.workplaceType : undefined, ...job.skills].filter(Boolean).slice(0, 7).map((tag) => <span key={tag}>{tag}</span>)}</div>
          {job.snippet || job.description ? <p>{(job.snippet ?? job.description ?? "").slice(0, 260)}{(job.snippet ?? job.description ?? "").length > 260 ? "…" : ""}</p> : null}
        </div>
        <div className="result-actions">
          <SaveJobButton job={job} />
          <a href={job.sourceUrl} target="_blank" rel="noreferrer">Open Job</a>
          {job.applicationUrl ? <a href={job.applicationUrl} target="_blank" rel="noreferrer">Apply</a> : null}
        </div>
      </article>)}
      {!loading && !jobs.length ? <div className="search-empty"><Search size={28} /><h2>{searched ? "No jobs matched this search" : "Describe the role you want"}</h2><p>{searched ? "Try a wider date range or related role. Missing optional API credentials do not stop other enabled providers or public discovery." : "Searches are interpreted into roles, locations, employment type, workplace, and freshness, then queried across enabled sources in parallel."}</p></div> : null}
    </div>
  </div>;
}
