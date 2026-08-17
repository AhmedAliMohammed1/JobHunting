"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, Trash2 } from "lucide-react";
import { splitList } from "@/src/lib/validation/product";

type SavedSearch = { id: string; name: string; query: { keywords?: string[]; roles?: string[]; locations?: string[] }; enabled: boolean; schedule: string; minimum_match_score: number; next_run_at?: string };

export function SavedSearchesManager() {
  const [items, setItems] = useState<SavedSearch[]>([]); const [message, setMessage] = useState("Loading saved searches…");
  const load = useCallback(async () => { const response = await fetch("/api/searches"); const body = await response.json() as { searches?: SavedSearch[]; error?: string }; if (response.ok) { setItems(body.searches ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load saved searches."); }, []);
  useEffect(() => { void fetch("/api/searches").then(async (response) => ({ response, body: await response.json() as { searches?: SavedSearch[]; error?: string } })).then(({ response, body }) => { if (response.ok) { setItems(body.searches ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load saved searches."); }); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setMessage("Saving search…");
    const queryText = String(form.get("query") ?? "");
    const payload = { name: String(form.get("name") ?? ""), schedule: String(form.get("schedule") ?? "daily"), enabled: true, minimumMatchScore: Number(form.get("minimumMatchScore")), query: { keywords: splitList(queryText), roles: splitList(queryText), locations: splitList(String(form.get("locations") ?? "")), countries: [], employmentTypes: [], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], postedWithinHours: 168, limit: 25 } };
    const response = await fetch("/api/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json() as { error?: string };
    if (response.ok) { event.currentTarget.reset(); await load(); setMessage("Saved search created."); } else setMessage(body.error ?? "Could not save search.");
  }
  async function toggle(item: SavedSearch) { const response = await fetch(`/api/searches/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !item.enabled }) }); if (response.ok) await load(); else setMessage("Could not update the schedule."); }
  async function remove(id: string) { const response = await fetch(`/api/searches/${id}`, { method: "DELETE" }); if (response.ok) setItems((current) => current.filter((item) => item.id !== id)); else setMessage("Could not delete the search."); }
  return <div className="stacked-content"><form className="product-card profile-form" onSubmit={create}><h2>Create a search profile</h2><div className="form-grid"><label>Name<input name="name" required maxLength={120} /></label><label>Roles and keywords<input name="query" required placeholder="Applied AI, TypeScript" /></label><label>Locations<input name="locations" placeholder="Germany, Remote" /></label><label>Schedule<select name="schedule" defaultValue="daily"><option value="daily">Daily</option><option value="hourly">Hourly</option></select></label><label>Minimum match<input name="minimumMatchScore" type="number" min="0" max="100" defaultValue="75" /></label></div><button type="submit">Save search</button></form>
    {items.length ? <div className="application-list">{items.map((item) => <article className="result-card" key={item.id}><Search /><div><span className="source-label">{item.enabled ? `${item.schedule.toUpperCase()} · ACTIVE` : "PAUSED"}</span><h2>{item.name}</h2><p>{[...(item.query.roles ?? []), ...(item.query.locations ?? [])].join(" · ") || "No filters"} · ≥ {item.minimum_match_score}% match</p></div><div className="result-actions"><button className="secondary-button" type="button" onClick={() => toggle(item)}>{item.enabled ? "Pause" : "Resume"}</button><button className="icon-button" type="button" aria-label={`Delete ${item.name}`} onClick={() => remove(item.id)}><Trash2 size={16} /></button></div></article>)}</div> : <article className="product-card"><p className="card-empty"><Search /> No saved searches yet.</p></article>}
    <p className="form-status" role="status">{message}</p></div>;
}
