"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, Bookmark, Bot, BriefcaseBusiness, ClipboardList, Search, Sparkles, UserRound } from "lucide-react";
import type { MatchResult } from "@/src/types/matching";
import type { NormalizedJob } from "@/src/types/jobs";

type Summary = {
  counts: { savedJobs: number; applications: number; unreadNotifications: number };
  profileComplete: boolean;
  automation: { enabled: boolean; simulation_completed_at?: string };
};
type Application = { id: string; stage: string; state: string; risk: string; updated_at: string; job: { title: string; company: string; location?: string } };
type Recommendation = { job: NormalizedJob; match: MatchResult };

const activeStages = new Set(["Planning", "Applying"]);
const submittedStages = new Set(["Applied", "Assessment"]);

export function DashboardOverview() {
  const [summary, setSummary] = useState<Summary>();
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [workspaceMessage, setWorkspaceMessage] = useState("Loading your workspace…");
  const [applicationMessage, setApplicationMessage] = useState("Loading application status…");
  const [recommendationMessage, setRecommendationMessage] = useState("Calculating your best live matches…");

  useEffect(() => {
    void fetch("/api/workspace/summary").then(async (response) => ({ response, body: await response.json() as Summary & { error?: string } })).then(({ response, body }) => {
      if (!response.ok) throw new Error(body.error ?? "Could not load workspace.");
      setSummary(body); setWorkspaceMessage("");
    }).catch((error: Error) => setWorkspaceMessage(error.message));

    void fetch("/api/applications").then(async (response) => ({ response, body: await response.json() as { applications?: Application[]; error?: string } })).then(({ response, body }) => {
      if (!response.ok) throw new Error(body.error ?? "Could not load applications.");
      setApplications(body.applications ?? []); setApplicationMessage("");
    }).catch((error: Error) => setApplicationMessage(error.message));

    void fetch("/api/recommendations").then(async (response) => ({ response, body: await response.json() as { recommendations?: Recommendation[]; reason?: string; error?: string } })).then(({ response, body }) => {
      if (!response.ok) throw new Error(body.error ?? "Could not load recommendations.");
      setRecommendations(body.recommendations ?? []); setRecommendationMessage(body.reason ?? "");
    }).catch((error: Error) => setRecommendationMessage(error.message));
  }, []);

  const pipeline = useMemo(() => ({
    active: applications.filter(({ stage }) => activeStages.has(stage)).length,
    submitted: applications.filter(({ stage }) => submittedStages.has(stage)).length,
    interviews: applications.filter(({ stage }) => stage === "Interview").length,
    offers: applications.filter(({ stage }) => stage === "Offer").length,
  }), [applications]);

  const cards = [
    { href: "/search", icon: Search, title: "Discover roles", detail: "Search live providers with transparent filters." },
    { href: "/recommended", icon: Sparkles, title: `${recommendations.length} recommended matches`, detail: recommendationMessage || "Review ranked roles and the evidence behind every score." },
    { href: "/saved", icon: Bookmark, title: `${summary?.counts.savedJobs ?? 0} saved jobs`, detail: "Review your durable shortlist." },
    { href: "/applications", icon: BriefcaseBusiness, title: `${summary?.counts.applications ?? applications.length} applications`, detail: "Update stages and retain a paper trail." },
    { href: "/notifications", icon: Bell, title: `${summary?.counts.unreadNotifications ?? 0} unread alerts`, detail: "See deduplicated saved-search matches." },
    { href: "/profile", icon: UserRound, title: summary?.profileComplete ? "Profile ready" : "Complete your profile", detail: "Matching only uses facts you can edit." },
    { href: "/settings/auto-apply", icon: Bot, title: summary?.automation.enabled ? "Auto Apply enabled" : "Auto Apply is off by default", detail: summary?.automation.simulation_completed_at ? "Safety simulation passed." : "Run the safety simulation before enablement." },
  ];

  return <div className="stacked-content dashboard-overview">
    <div className="dashboard-status-grid">
      <section className="product-card dashboard-status-card" aria-labelledby="application-pipeline-title">
        <div className="dashboard-card-heading"><div><span className="tiny-label">Application status</span><h2 id="application-pipeline-title">Application pipeline</h2></div><Link href="/applications">View all <ArrowRight size={14} /></Link></div>
        <div className="pipeline-summary" aria-label="Application stage totals">
          <span><strong>{pipeline.active}</strong><small>Preparing</small></span>
          <span><strong>{pipeline.submitted}</strong><small>Submitted</small></span>
          <span><strong>{pipeline.interviews}</strong><small>Interviews</small></span>
          <span><strong>{pipeline.offers}</strong><small>Offers</small></span>
        </div>
        {applications.length ? <div className="dashboard-activity-list">{applications.slice(0, 3).map((application) => <Link href="/applications" key={application.id}><span className="activity-icon"><BriefcaseBusiness size={15} /></span><span><strong>{application.job.title}</strong><small>{application.job.company} · {application.stage}</small></span><time>{new Date(application.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></Link>)}</div> : <div className="dashboard-empty"><ClipboardList size={20} /><p>{applicationMessage || "No applications yet. Save a role and add it to your pipeline."}</p><Link href="/search">Find a role</Link></div>}
      </section>

      <section className="product-card dashboard-status-card" aria-labelledby="recommendations-title">
        <div className="dashboard-card-heading"><div><span className="tiny-label">Live matching</span><h2 id="recommendations-title">Top recommendations</h2></div><Link href="/recommended">View all <ArrowRight size={14} /></Link></div>
        {recommendations.length ? <div className="dashboard-recommendation-list">{recommendations.slice(0, 3).map(({ job, match }) => <Link href="/recommended" key={job.id}><span className="dashboard-match-score">{match.score}%</span><span><strong>{job.title}</strong><small>{job.company} · {match.band}</small></span><ArrowRight size={14} /></Link>)}</div> : <div className="dashboard-empty"><Sparkles size={20} /><p>{recommendationMessage || "No recommendations match every profile preference yet."}</p><Link href="/profile">Review preferences</Link></div>}
      </section>
    </div>

    <section className="dashboard-actions" aria-labelledby="workspace-actions-title">
      <div className="dashboard-section-heading"><div><span className="tiny-label">Everything in one place</span><h2 id="workspace-actions-title">Workspace actions</h2></div><p>Search, save, apply, and manage your account without leaving the dashboard.</p></div>
      <div className="settings-grid dashboard-action-grid">{cards.map((card) => <Link className="product-card card-link" href={card.href} key={card.href}><card.icon /><h2>{card.title}</h2><p>{card.detail}</p></Link>)}</div>
    </section>
    <p className="form-status" role="status">{workspaceMessage}</p>
  </div>;
}
