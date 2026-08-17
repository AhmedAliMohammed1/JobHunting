"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Bookmark, Bot, BriefcaseBusiness, Search, UserRound } from "lucide-react";

type Summary = { counts: { savedJobs: number; applications: number; unreadNotifications: number }; profileComplete: boolean; automation: { enabled: boolean; simulation_completed_at?: string } };
export function DashboardOverview() {
  const [summary, setSummary] = useState<Summary>(); const [message, setMessage] = useState("Loading your workspace…");
  useEffect(() => { fetch("/api/workspace/summary").then(async (response) => ({ response, body: await response.json() as Summary & { error?: string } })).then(({ response, body }) => { if (!response.ok) throw new Error(body.error ?? "Could not load workspace."); setSummary(body); setMessage(""); }).catch((error: Error) => setMessage(error.message)); }, []);
  const cards = [
    { href: "/search", icon: Search, title: "Discover roles", detail: "Search live providers with transparent filters." },
    { href: "/saved", icon: Bookmark, title: `${summary?.counts.savedJobs ?? 0} saved jobs`, detail: "Review your durable shortlist." },
    { href: "/applications", icon: BriefcaseBusiness, title: `${summary?.counts.applications ?? 0} applications`, detail: "Update stages and retain a paper trail." },
    { href: "/notifications", icon: Bell, title: `${summary?.counts.unreadNotifications ?? 0} unread alerts`, detail: "See deduplicated saved-search matches." },
    { href: "/profile", icon: UserRound, title: summary?.profileComplete ? "Profile ready" : "Complete your profile", detail: "Matching only uses facts you can edit." },
    { href: "/settings/auto-apply", icon: Bot, title: summary?.automation.enabled ? "Auto Apply enabled" : "Auto Apply is off by default", detail: summary?.automation.simulation_completed_at ? "Safety simulation passed." : "Run the safety simulation before enablement." },
  ];
  return <div className="stacked-content"><div className="settings-grid">{cards.map((card) => <Link className="product-card card-link" href={card.href} key={card.href}><card.icon /><h2>{card.title}</h2><p>{card.detail}</p></Link>)}</div><p className="form-status" role="status">{message}</p></div>;
}
