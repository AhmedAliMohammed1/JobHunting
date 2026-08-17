"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { NormalizedJob } from "@/src/types/jobs";

export function SearchWorkspace() {
  const [query, setQuery] = useState("TypeScript product engineer remote Europe");
  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [notice, setNotice] = useState("Development mode uses clearly labeled local fixtures.");
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const response = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, filters: { limit: 25 } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Search failed");
      setJobs(body.jobs);
      setNotice(body.disclosure ?? (body.partial ? "Some providers were unavailable; results are partial." : `${body.jobs.length} roles returned.`));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Search failed"); }
    finally { setLoading(false); }
  }

  return <div className="search-workspace">
    <div className="search-bar"><Search size={20} /><input aria-label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} /><button onClick={search} disabled={loading}>{loading ? "Searching…" : "Search"}</button></div>
    <div className="search-toolbar"><span><SlidersHorizontal size={16} /> Natural-language query with structured filters</span><strong>{notice}</strong></div>
    <div className="search-results" aria-live="polite">
      {jobs.map((job) => <article className="result-card" key={job.id}><div><span className="source-label">{job.provider === "mock" ? "DEVELOPMENT FIXTURE" : `${job.provider} · ${job.freshnessLabel}`}</span><h2>{job.title}</h2><p>{job.company} · {job.location ?? "Location not supplied"}</p><div className="tag-row">{job.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div></div><a href={job.sourceUrl} target="_blank" rel="noreferrer">View source</a></article>)}
      {!jobs.length && <div className="search-empty"><Search size={28} /><h2>Start with the role you want</h2><p>Results will show source, freshness, and provider health without pretending cached data is live.</p></div>}
    </div>
  </div>;
}
