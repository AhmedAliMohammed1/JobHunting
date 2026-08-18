"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { JobProviderCatalogEntry, JobSearchQuery, NormalizedJob, ProviderHealth, WorkplaceType } from "@/src/types/jobs";
import type { MatchResult } from "@/src/types/matching";
import { SaveJobButton } from "./save-job-button";
import { splitList } from "@/src/lib/validation/product";

const subscribeToHydration = () => () => {};

type SearchOrigin = "normal" | "llm" | "both";
type LLMJobAssessment = {
  id: string;
  relevanceScore: number;
  cvFitScore: number;
  confidence: number;
  reasons: string[];
  matchedConcepts: string[];
  concerns: string[];
};
type LLMSearchPlan = {
  intentSummary: string;
  roles: string[];
  keywords: string[];
  searchAngles: string[];
};
type SearchModes = {
  normal: { count: number; sourceBreakdown: Record<string, number> };
  llm: { count: number; sourceBreakdown: Record<string, number>; available: boolean };
  overlap: number;
  combined: number;
};
type SearchJob = NormalizedJob & {
  match?: MatchResult;
  searchOrigin?: SearchOrigin;
  hybridScore?: number;
  aiAssessment?: LLMJobAssessment;
};
type SearchResponse = {
  jobs: SearchJob[];
  providers: ProviderHealth[];
  partial: boolean;
  interpretedQuery: JobSearchQuery;
  llmQuery?: JobSearchQuery;
  llmPlan?: LLMSearchPlan;
  warnings?: string[];
  disclosure?: string;
  totalMatches?: number;
  sourceBreakdown?: Record<string, number>;
  searchModes?: SearchModes;
  scoring?: { formula?: string };
  engineVersion?: string;
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
    ...query.roles.slice(0, 6),
    ...query.keywords.slice(0, 4),
    ...query.locations,
    ...query.countries,
    ...query.experienceLevels.slice(0, 2),
    ...query.employmentTypes,
    ...query.workplaceTypes,
    query.postedWithinHours ? `Past ${query.postedWithinHours}h` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function postedLabel(postedAt: string | undefined): string {
  if (!postedAt) return "Posting date not supplied by source";
  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp)) return "Posting date not supplied by source";
  const date = new Date(timestamp);
  const absolute = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return `Posted recently · ${absolute}`;
  if (hours < 24) return `Posted ${hours}h ago · ${absolute}`;
  const days = Math.floor(hours / 24);
  return `Posted ${days}d ago · ${absolute}`;
}

function originLabel(origin: SearchOrigin | undefined): string {
  if (origin === "llm") return "LLM search";
  if (origin === "both") return "Normal + LLM";
  return "Normal search";
}

function scoreLabel(job: SearchJob): string {
  if (job.hybridScore !== undefined && job.aiAssessment) return "Hybrid fit";
  if (job.match) return "CV match";
  if (job.hybridScore !== undefined) return "AI relevance";
  return "Match";
}

export function SearchWorkspace() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const requestSequence = useRef(0);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<JobProviderCatalogEntry[]>([]);
  const [interpretedQuery, setInterpretedQuery] = useState<JobSearchQuery>();
  const [notice, setNotice] = useState("Search recent vacancies with normal retrieval and grounded LLM search.");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number>>({});
  const [totalMatches, setTotalMatches] = useState(0);
  const [searchModes, setSearchModes] = useState<SearchModes>();
  const [llmPlan, setLlmPlan] = useState<LLMSearchPlan>();
  const [engineVersion, setEngineVersion] = useState("");
  const [scoringFormula, setScoringFormula] = useState("");
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
    setSearchModes(undefined);
    setLlmPlan(undefined);
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        cache: "no-store",
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
      setSourceBreakdown(body.sourceBreakdown ?? {});
      setTotalMatches(body.totalMatches ?? body.jobs.length);
      setSearchModes(body.searchModes);
      setLlmPlan(body.llmPlan);
      setEngineVersion(body.engineVersion ?? response.headers.get("X-Search-Engine-Version") ?? "");
      setScoringFormula(body.scoring?.formula ?? "");
      setSearched(true);
      setNotice(body.partial ? `${body.disclosure ?? "Search completed."} Some optional sources were unavailable.` : body.disclosure ?? `${body.jobs.length} roles returned.`);
    } catch (error) {
      if (sequence === requestSequence.current) {
        setSearched(true);
        setJobs([]);
        setProviders([]);
        setSourceBreakdown({});
        setTotalMatches(0);
        setSearchModes(undefined);
        setLlmPlan(undefined);
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

  const failedProviders = providers.filter((provider) => !provider.ok);
  const chips = queryChips(interpretedQuery);
  const selectableSources = providerCatalog.filter((provider) => ["active", "discovery", "ats-discovery"].includes(provider.availability) && provider.id !== "mock");
  const enabledSourceCount = selectableSources.length;
  const sourceEntries = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]);
  const rawRows = providers.reduce((total, provider) => total + (provider.jobsReturned ?? 0), 0);

  return <div className="search-workspace">
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <Search size={20} />
      <input aria-label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} disabled={!hydrated} placeholder="e.g. Embedded automotive software in Germany, last 3 days" />
      <button type="submit" disabled={!hydrated || loading}>{loading ? "Normal + LLM search…" : "Search"}</button>
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
      <label>Minimum salary<input type="number" min="0" step="1000" value={minimumSalary} onChange={(event) => setMinimumSalary(event.target.value)} placeholder="e.g. 60000 (optional)" /></label>
      <label>Minimum CV match<select value={minimumMatch} onChange={(event) => setMinimumMatch(event.target.value)}><option value="">Any</option><option value="60">60%</option><option value="70">70%</option><option value="80">80%</option><option value="90">90%</option></select></label>
    </div> : null}

    {providerCatalog.length ? <details className="provider-catalog">
      <summary>Search sources: {enabledSourceCount} enabled · normal + grounded LLM search</summary>
      <p>Normal search queries configured APIs, feeds, ATS boards and public discovery. LLM search expands the semantic intent, then searches the same grounded public job pages. Job URLs and factual fields always come from retrieval, not model-generated links.</p>
      <div className="provider-catalog-grid">
        {providerCatalog.map((provider) => <article key={provider.id}>
          <div><strong>{provider.name}</strong><span className={`provider-state provider-state-${provider.availability}`}>{AVAILABILITY_LABELS[provider.availability]}</span></div>
          <p>{provider.detail}</p>
          {provider.setup ? <small>{provider.setup}</small> : null}
        </article>)}
      </div>
    </details> : null}

    {chips.length ? <div className="interpreted-query" aria-label="Hard search filters"><strong>Normal search intent</strong>{chips.map((chip) => <span key={chip}>{chip}</span>)}</div> : null}

    {llmPlan ? <details className="provider-catalog" open>
      <summary><Sparkles size={15} /> LLM semantic search plan</summary>
      <p>{llmPlan.intentSummary}</p>
      <div className="interpreted-query" aria-label="LLM expanded roles"><strong>LLM roles</strong>{llmPlan.roles.slice(0, 12).map((role) => <span key={role}>{role}</span>)}</div>
      {llmPlan.keywords.length ? <div className="interpreted-query" aria-label="LLM search concepts"><strong>LLM concepts</strong>{llmPlan.keywords.slice(0, 12).map((keyword) => <span key={keyword}>{keyword}</span>)}</div> : null}
    </details> : null}

    {searchModes ? <div className="interpreted-query" aria-label="Search mode results">
      <strong>Search engines</strong>
      <span>Normal: {searchModes.normal.count}</span>
      <span>LLM: {searchModes.llm.count}</span>
      <span>Found by both: {searchModes.overlap}</span>
      <span>Final: {searchModes.combined}</span>
      {engineVersion ? <span>Engine {engineVersion}</span> : null}
    </div> : null}

    {providers.length ? <p className="provider-summary">{providers.length} technical provider pipeline{providers.length === 1 ? "" : "s"} used across {enabledSourceCount} enabled logical sources · {rawRows} grounded rows returned by provider passes · {totalMatches} final unique matches{failedProviders.length ? ` · ${failedProviders.length} optional pipeline${failedProviders.length === 1 ? "" : "s"} unavailable` : ""}</p> : null}

    {sourceEntries.length ? <div className="interpreted-query" aria-label="Final jobs by source"><strong>Final results by source</strong>{sourceEntries.map(([provider, count]) => <span key={provider}>{PROVIDER_LABELS[provider] ?? provider}: {count}</span>)}</div> : null}

    {scoringFormula ? <p className="provider-summary"><strong>Hybrid ranking:</strong> {scoringFormula}</p> : null}
    {warnings.map((warning) => <p className="search-warning" key={warning}><AlertTriangle size={15} />{warning}</p>)}
    {failedProviders.map((provider) => <p className="search-warning" key={provider.providerId}><AlertTriangle size={15} />{PROVIDER_LABELS[provider.providerId] ?? provider.providerId} was unavailable for this search.</p>)}
    {savedSearchMessage ? <p className="form-status" role="status">{savedSearchMessage}</p> : null}

    <div className="search-results" aria-live="polite" aria-busy={loading}>
      {loading ? Array.from({ length: 3 }, (_, index) => <div className="result-card search-skeleton" key={index}><div /><span /></div>) : null}
      {!loading && jobs.map((job) => {
        const displayScore = job.hybridScore ?? job.match?.score;
        const sourceLabel = PROVIDER_LABELS[job.provider] ?? job.provider;
        const concepts = job.aiAssessment?.matchedConcepts ?? [];
        const reasons = job.aiAssessment?.reasons ?? [];
        const concerns = job.aiAssessment?.concerns ?? [];
        return <article className="result-card" key={job.id}>
          {displayScore !== undefined ? <strong className="match-score" aria-label={`${displayScore}% ${scoreLabel(job)}`}>{displayScore}%</strong> : null}
          <div>
            <span className="source-label">{job.provider === "mock" ? "DEVELOPMENT FIXTURE" : `${sourceLabel} · ${job.freshnessLabel}`}</span>
            <div className="tag-row">
              <span>{originLabel(job.searchOrigin)}</span>
              {displayScore !== undefined ? <span>{scoreLabel(job)} {displayScore}%</span> : null}
              {job.match && job.hybridScore !== undefined ? <span>Deterministic CV {job.match.score}%</span> : null}
              {job.aiAssessment ? <span>AI relevance {job.aiAssessment.relevanceScore}%</span> : null}
              {job.aiAssessment ? <span>AI CV fit {job.aiAssessment.cvFitScore}%</span> : null}
              {job.aiAssessment ? <span>AI confidence {job.aiAssessment.confidence}%</span> : null}
            </div>
            <h2>{job.title}</h2>
            <p>{job.company} · {job.location ?? job.city ?? job.country ?? "Location not supplied"}</p>
            <small>{postedLabel(job.postedAt)}</small>
            <div className="tag-row">{[job.employmentType, job.seniority, job.workplaceType !== "unknown" ? job.workplaceType : undefined, ...job.skills].filter(Boolean).slice(0, 9).map((tag) => <span key={tag}>{tag}</span>)}</div>
            {job.snippet || job.description ? <p>{(job.snippet ?? job.description ?? "").slice(0, 320)}{(job.snippet ?? job.description ?? "").length > 320 ? "…" : ""}</p> : null}
            {reasons.length ? <p><strong>AI assessment:</strong> {reasons.join(" · ")}</p> : null}
            {concepts.length ? <div className="tag-row">{concepts.slice(0, 8).map((concept) => <span key={concept}>✓ {concept}</span>)}</div> : null}
            {concerns.length ? <p><strong>Check:</strong> {concerns.join(" · ")}</p> : null}
            {job.match?.reasons?.length ? <p><strong>CV evidence:</strong> {job.match.reasons.join(" · ")}</p> : null}
          </div>
          <div className="result-actions">
            <SaveJobButton job={job} />
            <a href={job.sourceUrl} target="_blank" rel="noreferrer">Open Job</a>
            {job.applicationUrl && job.applicationUrl !== job.sourceUrl ? <a href={job.applicationUrl} target="_blank" rel="noreferrer">Apply</a> : null}
          </div>
        </article>;
      })}
      {!loading && !jobs.length ? <div className="search-empty"><Search size={28} /><h2>{searched ? "No verified jobs matched this search" : "Describe the role you want"}</h2><p>{searched ? "Try a wider date range or related role. Date-filtered searches intentionally reject jobs whose posting date cannot be verified." : "One search runs the normal retrieval engine and a grounded LLM semantic search, then merges and CV-ranks the verified results."}</p></div> : null}
    </div>
  </div>;
}
