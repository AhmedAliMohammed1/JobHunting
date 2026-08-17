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
  remotive: "Remotive",
  mock: "Development fixture",
};

const AVAILABILITY_LABELS: Record<JobProviderCatalogEntry["availability"], string> = {
  active: "Active",
  "needs-api-key": "API key needed",
  "needs-company-board": "Company boards needed",
  "partner-access": "Partner access needed",
  restricted: "Not enabled",
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

export function SearchWorkspace() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const requestSequence = useRef(0);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [configuredSources, setConfiguredSources] = useState<string[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<JobProviderCatalogEntry[]>([]);
  const [interpretedQuery, setInterpretedQuery] = useState<JobSearchQuery>();
  const [notice, setNotice] = useState("Search live vacancies with natural language or precise filters.");
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
        return response.json() as Promise<{ providers?: string[]; providerCatalog?: JobProviderCatalogEntry[] }>;
      })
      .then((status) => {
        setConfiguredSources(status.providers ?? []);
        setProviderCatalog(status.providerCatalog ?? []);
      })
      .catch(() => {
        setConfiguredSources([]);
        setProviderCatalog([]);
      });
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
      setNotice(body.partial ? `${body.disclosure ?? "Search completed."} Some sources were unavailable.` : body.disclosure ?? `${body.jobs.length} roles returned.`);
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
  const selectableSources = providerCatalog.filter((provider) => configuredSources.includes(provider.id) && provider.id !== "mock");
  const activeSourceCount = providerCatalog.filter((provider) => provider.availability === "active").length;

  return <div className="search-workspace">
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <Search size={20} />
      <input aria-label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} disabled={!hydrated} placeholder="e.g. Find junior AI and LLM jobs in Germany posted this week" />
      <button type="submit" disabled={!hydrated || loading}>{loading ? "Searching sources…" : "Search"}</button>
    </form>
    <div className="search-toolbar">
      <button className="text-button" type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} disabled={!hydrated}><SlidersHorizontal size={16} /> Filters</button>
      <strong role="status">{notice}</strong>
      <button className="secondary-button" type="button" onClick={() => void saveSearch()} disabled={!hydrated || loading}>Save search</button>
    </div>
    {filtersOpen ? <div className="filter-panel">
      <label>Locations<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Berlin, Munich" /></label>
      <label>Countries<input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Germany, United Kingdom" /></label>
      <label>Workplace<select value={workplace} onChange={(event) => setWorkplace(event.target.value)}><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
      <label>Employment type<select value={employment} onChange={(event) => setEmployment(event.target.value)}><option value="">Any</option><option value="Full-time">Full-time</option><option value="Part-time">Part-time</option><option value="Contract">Contract</option><option value="Internship">Internship</option><option value="Freelance">Freelance</option></select></label>
      <label>Experience<select value={experience} onChange={(event) => setExperience(event.target.value)}><option value="">Any</option><option value="Internship">Internship</option><option value="Junior">Junior / entry level</option><option value="Mid level">Mid level</option><option value="Senior">Senior</option><option value="Lead">Lead / staff</option></select></label>
      <label>Date posted<select value={postedWithin} onChange={(event) => setPostedWithin(event.target.value)}><option value="">Any</option><option value="24">Past day</option><option value="168">Past week</option><option value="720">Past month</option></select></label>
      <label>Company<input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company names" /></label>
      <label>Source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">All configured sources</option>{selectableSources.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}</select></label>
      <label>Minimum salary<input type="number" min="0" step="1000" value={minimumSalary} onChange={(event) => setMinimumSalary(event.target.value)} placeholder="60000" /></label>
      <label>Minimum CV match<select value={minimumMatch} onChange={(event) => setMinimumMatch(event.target.value)}><option value="">Any</option><option value="60">60%</option><option value="70">70%</option><option value="80">80%</option><option value="90">90%</option></select></label>
    </div> : null}
    {providerCatalog.length ? <details className="provider-catalog">
      <summary>Search sources: {activeSourceCount} active · {providerCatalog.length - activeSourceCount} available with access or setup</summary>
      <p>Only official APIs, public employer boards, and approved feeds are connected. Sites without compliant search access are listed honestly instead of being scraped.</p>
      <div className="provider-catalog-grid">
        {providerCatalog.map((provider) => <article key={provider.id}>
          <div><strong>{provider.name}</strong><span className={`provider-state provider-state-${provider.availability}`}>{AVAILABILITY_LABELS[provider.availability]}</span></div>
          <p>{provider.detail}</p>
          {provider.setup ? <small>{provider.setup}</small> : null}
        </article>)}
      </div>
    </details> : null}
    {chips.length ? <div className="interpreted-query" aria-label="Interpreted search filters"><strong>Understood as</strong>{chips.map((chip) => <span key={chip}>{chip}</span>)}</div> : null}
    {providers.length ? <p className="provider-summary">{providers.length} source{providers.length === 1 ? "" : "s"} searched · {providers.reduce((total, provider) => total + (provider.jobsReturned ?? 0), 0)} matching rows before deduplication{failedProviders ? ` · ${failedProviders} unavailable` : ""}</p> : null}
    {warnings.map((warning) => <p className="search-warning" key={warning}><AlertTriangle size={15} />{warning}</p>)}
    {savedSearchMessage ? <p className="form-status" role="status">{savedSearchMessage}</p> : null}
    <div className="search-results" aria-live="polite" aria-busy={loading}>
      {loading ? Array.from({ length: 3 }, (_, index) => <div className="result-card search-skeleton" key={index}><div /><span /></div>) : null}
      {!loading && jobs.map((job) => <article className="result-card" key={job.id}>
        {job.match ? <strong className="match-score" aria-label={`${job.match.score}% CV match`}>{job.match.score}%</strong> : null}
        <div>
          <span className="source-label">{job.provider === "mock" ? "DEVELOPMENT FIXTURE" : `${PROVIDER_LABELS[job.provider] ?? job.provider} · ${job.freshnessLabel}`}</span>
          <h2>{job.title}</h2>
          <p>{job.company} · {job.location ?? "Location not supplied"}</p>
          <div className="tag-row">{[job.employmentType, job.seniority, job.workplaceType, ...job.skills].filter(Boolean).slice(0, 7).map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <div className="result-actions"><SaveJobButton job={job} /><a href={job.sourceUrl} target="_blank" rel="noreferrer">View on {PROVIDER_LABELS[job.provider] ?? job.provider}</a></div>
      </article>)}
      {!loading && !jobs.length ? <div className="search-empty"><Search size={28} /><h2>{searched ? "No jobs match every filter" : "Describe the role you want"}</h2><p>{searched ? "Try a wider date range, a related role, or remove one location or experience filter. The engine will not show unrelated jobs just to fill the page." : "Natural language is interpreted into roles, locations, experience, workplace, and freshness before live providers are searched in parallel."}</p></div> : null}
    </div>
  </div>;
}
