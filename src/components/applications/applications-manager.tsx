"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

const stages = ["Saved", "Planning", "Applying", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
type Application = { id: string; stage: string; state: string; risk: string; updated_at: string; job: { title: string; company: string; location?: string; status: string } };

export function ApplicationsManager() {
  const [items, setItems] = useState<Application[]>([]); const [message, setMessage] = useState("Loading applications…");
  const load = useCallback(async () => { const response = await fetch("/api/applications"); const body = await response.json() as { applications?: Application[]; error?: string }; if (response.ok) { setItems(body.applications ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load applications."); }, []);
  useEffect(() => { void fetch("/api/applications").then(async (response) => ({ response, body: await response.json() as { applications?: Application[]; error?: string } })).then(({ response, body }) => { if (response.ok) { setItems(body.applications ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load applications."); }); }, []);
  async function update(id: string, stage: string) {
    setMessage("Saving stage…");
    const response = await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) }); const body = await response.json() as { error?: string };
    if (response.ok) { await load(); setMessage("Stage updated."); } else setMessage(body.error ?? "Could not update stage.");
  }
  if (!items.length) return <article className="product-card"><h2>Application pipeline</h2><p className="card-empty"><ClipboardList /> {message || "Track a saved job to start your application pipeline."}</p></article>;
  return <div className="application-list">{items.map((item) => <article className="result-card" key={item.id}><div><span className="source-label">{item.state} · {item.risk} RISK</span><h2>{item.job.title}</h2><p>{item.job.company} · {item.job.location ?? "Location not supplied"}</p></div><label>Stage<select aria-label={`Stage for ${item.job.title}`} value={item.stage} onChange={(event) => update(item.id, event.target.value)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label></article>)}<p className="form-status" role="status">{message}</p></div>;
}
