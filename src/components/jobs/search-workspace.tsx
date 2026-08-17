"use client";

import { useState, useSyncExternalStore } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { NormalizedJob } from "@/src/types/jobs";
import { SaveJobButton } from "./save-job-button";
import { splitList } from "@/src/lib/validation/product";

const subscribeToHydration = () => () => {};

export function SearchWorkspace() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [query, setQuery] = useState("TypeScript product engineer remote Europe");
  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [notice, setNotice] = useState("Development mode uses clearly labeled local fixtures.");
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [postedWithin, setPostedWithin] = useState("168");
  const [savedSearchMessage, setSavedSearchMessage] = useState("");

  async function search() {
    setLoading(true);
    try {
      const response = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, filters: { limit: 25, locations: splitList(location), workplaceTypes: workplace ? [workplace] : [], postedWithinHours: postedWithin ? Number(postedWithin) : undefined } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Search failed");
      setJobs(body.jobs);
      setNotice(body.disclosure ?? (body.partial ? "Some providers were unavailable; results are partial." : `${body.jobs.length} roles returned.`));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Search failed"); }
    finally { setLoading(false); }
  }

  async function saveSearch() {
    const searchName = query.trim().slice(0, 120);
    if (!searchName) { setSavedSearchMessage("Enter a search query first."); return; }
    const response = await fetch("/api/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: searchName, enabled: true, schedule: "daily", minimumMatchScore: 75, query: { keywords: [query], roles: [], locations: splitList(location), countries: [], employmentTypes: [], workplaceTypes: workplace ? [workplace] : [], experienceLevels: [], companies: [], excludedCompanies: [], postedWithinHours: postedWithin ? Number(postedWithin) : undefined, limit: 25 } }) });
    const body = await response.json() as { error?: string };
    setSavedSearchMessage(response.ok ? "Search saved and scheduled daily." : body.error ?? "Could not save search.");
  }

  return <div className="search-workspace">
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); search(); }}><Search size={20} /><input aria-label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} required /><button type="submit" disabled={!hydrated || loading}>{loading ? "Searching…" : "Search"}</button></form>
    <div className="search-toolbar"><button className="text-button" type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} /> Filters</button><strong role="status">{notice}</strong><button className="secondary-button" type="button" onClick={saveSearch}>Save search</button></div>
    {filtersOpen ? <div className="filter-panel"><label>Locations<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Berlin, Remote in Europe" /></label><label>Workplace<select value={workplace} onChange={(event) => setWorkplace(event.target.value)}><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><label>Freshness<select value={postedWithin} onChange={(event) => setPostedWithin(event.target.value)}><option value="24">Past day</option><option value="168">Past week</option><option value="720">Past month</option><option value="">Any</option></select></label></div> : null}
    {savedSearchMessage ? <p className="form-status" role="status">{savedSearchMessage}</p> : null}
    <div className="search-results" aria-live="polite">
      {jobs.map((job) => <article className="result-card" key={job.id}><div><span className="source-label">{job.provider === "mock" ? "DEVELOPMENT FIXTURE" : `${job.provider} · ${job.freshnessLabel}`}</span><h2>{job.title}</h2><p>{job.company} · {job.location ?? "Location not supplied"}</p><div className="tag-row">{job.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="result-actions"><SaveJobButton job={job} /><a href={job.sourceUrl} target="_blank" rel="noreferrer">View source</a></div></article>)}
      {!jobs.length && <div className="search-empty"><Search size={28} /><h2>Start with the role you want</h2><p>Results will show source, freshness, and provider health without pretending cached data is live.</p></div>}
    </div>
  </div>;
}
