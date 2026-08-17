"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type Notification = { id: string; title: string; body: string; read_at?: string; created_at: string; data?: { sourceUrl?: string } };
export function NotificationsManager() {
  const [items, setItems] = useState<Notification[]>([]); const [message, setMessage] = useState("Loading notifications…");
  const load = useCallback(async () => { const response = await fetch("/api/notifications"); const body = await response.json() as { notifications?: Notification[]; error?: string }; if (response.ok) { setItems(body.notifications ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load notifications."); }, []);
  useEffect(() => { void fetch("/api/notifications").then(async (response) => ({ response, body: await response.json() as { notifications?: Notification[]; error?: string } })).then(({ response, body }) => { if (response.ok) { setItems(body.notifications ?? []); setMessage(""); } else setMessage(body.error ?? "Could not load notifications."); }); }, []);
  async function mark(id?: string) { const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) }); if (response.ok) await load(); else setMessage("Could not update notifications."); }
  if (!items.length) return <article className="product-card"><h2>Inbox</h2><p className="card-empty"><BellOff /> {message || "No notifications yet. Active saved searches deliver matching roles here."}</p></article>;
  return <div className="stacked-content"><button className="secondary-button align-right" type="button" onClick={() => mark()}>Mark all read</button><div className="application-list">{items.map((item) => <article className={`result-card ${item.read_at ? "is-read" : ""}`} key={item.id}><Bell /><div><span className="source-label">{item.read_at ? "READ" : "NEW"} · {new Date(item.created_at).toLocaleString()}</span><h2>{item.title}</h2><p>{item.body}</p></div><div className="result-actions">{item.data?.sourceUrl ? <a href={item.data.sourceUrl} target="_blank" rel="noreferrer">View role</a> : null}{!item.read_at ? <button className="secondary-button" type="button" onClick={() => mark(item.id)}>Mark read</button> : null}</div></article>)}</div><p role="status">{message}</p></div>;
}
