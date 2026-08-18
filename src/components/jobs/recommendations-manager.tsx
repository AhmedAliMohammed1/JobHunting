"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatchResult } from "@/src/types/matching";
import type { NormalizedJob } from "@/src/types/jobs";
import { SaveJobButton } from "./save-job-button";

type Recommendation = { job: NormalizedJob; match: MatchResult };
type RecommendationsResponse = { recommendations?: Recommendation[]; reason?: string; inferredRoles?: string[]; error?: string };

export function RecommendationsManager() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [message, setMessage] = useState("Calculating transparent CV match scores…");
  const [inferredRoles, setInferredRoles] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/recommendations", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() as RecommendationsResponse }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error ?? "Could not load recommendations.");
        setItems(body.recommendations ?? []);
        setInferredRoles(body.inferredRoles ?? []);
        setMessage(body.reason ?? "");
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  if (!items.length) return <article className="product-card"><h2>No ranked roles yet</h2><p>{message}</p><Link className="primary-link" href="/profile">Review profile preferences</Link></article>;

  return <div className="stacked-content">
    <article className="product-card">
      <h2>Recommended from your CV</h2>
      <p>{message}</p>
      {inferredRoles.length ? <div className="tag-row">{inferredRoles.slice(0, 6).map((role) => <span key={role}>{role}</span>)}</div> : null}
    </article>
    <div className="recommendation-list">{items.map(({ job, match }) => <article className="result-card" key={job.id}>
      <strong className="match-score">{match.score}%</strong>
      <div>
        <span className="source-label">{match.band} · {job.freshnessLabel}</span>
        <h2>{job.title}</h2>
        <p>{job.company} · {match.reasons.join(" · ")}</p>
        <div className="tag-row">{match.matchedSkills.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}</div>
      </div>
      <div className="result-actions"><SaveJobButton job={job} /><a href={job.sourceUrl} target="_blank" rel="noreferrer">View source</a></div>
    </article>)}</div>
  </div>;
}
