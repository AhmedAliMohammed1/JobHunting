"use client";

import { useEffect, useState } from "react";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";

type Source = { source_url: string; application_url?: string; provider: string; last_verified_at?: string };
type SavedJob = { id: string; job_id: string; priority: number; notes?: string; job: { title: string; company: string; location?: string; status: string; salary_text?: string; job_sources?: Source[]; job_skills?: Array<{ skill: string }> } };

export function SavedJobsManager() {
  const [items, setItems] = useState<SavedJob[]>([]);
  const [message, setMessage] = useState("Loading your shortlist…");
  useEffect(() => { void fetch("/api/jobs/saved").then(async (response) => ({ response, body: await response.json() as { savedJobs?: SavedJob[]; error?: string } })).then(({ response, body }) => { if (response.ok) { setItems(body.savedJobs ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load saved jobs."); }); }, []);

  async function remove(id: string) {
    const response = await fetch(`/api/jobs/saved/${id}`, { method: "DELETE" });
    if (response.ok) setItems((current) => current.filter((item) => item.id !== id)); else setMessage("Could not remove that job.");
  }
  async function track(item: SavedJob) {
    const source = item.job.job_sources?.[0];
    const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: item.job_id, applicationUrl: source?.application_url }) });
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? `${item.job.title} is now tracked in Applications.` : body.error ?? "Could not track application.");
  }
  if (!items.length) return <article className="product-card"><h2>Your shortlist</h2><p className="card-empty"><Bookmark /> {message || "Save a role from Discover to compare it here."}</p></article>;
  return <div className="application-list">{items.map((item) => { const source = item.job.job_sources?.[0]; return <article className="result-card" key={item.id}><div><span className="source-label">{item.job.status} · {source?.provider ?? "source unavailable"}</span><h2>{item.job.title}</h2><p>{item.job.company} · {item.job.location ?? "Location not supplied"}</p><div className="tag-row">{item.job.job_skills?.slice(0, 6).map(({ skill }) => <span key={skill}>{skill}</span>)}</div></div><div className="result-actions"><button className="secondary-button" type="button" onClick={() => track(item)}>Track application</button>{source?.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer">Source <ExternalLink size={14} /></a> : null}<button className="icon-button" aria-label={`Remove ${item.job.title}`} type="button" onClick={() => remove(item.id)}><Trash2 size={16} /></button></div></article>; })}<p className="form-status" role="status">{message}</p></div>;
}
