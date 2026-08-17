"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import type { NormalizedJob } from "@/src/types/jobs";

export function SaveJobButton({ job, title = job.title }: { job: NormalizedJob; title?: string }) {
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function save() {
    if (saved || pending) return;
    setPending(true); setError(undefined);
    const response = await fetch("/api/jobs/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job, priority: 0 }) });
    const body = await response.json() as { error?: string };
    if (response.ok) setSaved(true); else setError(body.error ?? "Could not save job.");
    setPending(false);
  }
  return <span className="save-control"><button className="save-button" type="button" aria-label={saved ? `${title} saved` : `Save ${title}`} aria-pressed={saved} disabled={pending || saved} onClick={save}>{saved ? <Check size={17} /> : <Bookmark size={17} />}</button>{error ? <span className="control-error" role="alert">{error}</span> : null}</span>;
}
