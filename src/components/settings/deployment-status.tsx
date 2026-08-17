"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
type Status = { ready: boolean; services: Record<string, boolean>; modes: { ai: string; jobs: string } };
export function DeploymentStatus() {
  const [status, setStatus] = useState<Status>();
  useEffect(() => { fetch("/api/config/status").then((response) => response.json()).then(setStatus).catch(() => setStatus(undefined)); }, []);
  return <article className="product-card"><h2>Deployment preflight</h2>{!status ? <p>Checking configuration…</p> : <><p className={status.ready ? "inline-safe" : "inline-warning"}>{status.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{status.ready ? "Core services are configured." : "One or more core services need configuration."}</p><div className="limit-list">{Object.entries(status.services).map(([name, ok]) => <span key={name}>{name}<strong>{ok ? "ready" : "missing"}</strong></span>)}<span>AI mode<strong>{status.modes.ai}</strong></span><span>Job mode<strong>{status.modes.jobs}</strong></span></div></>}</article>;
}
