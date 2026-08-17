"use client";

import { useState } from "react";
import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";

export function AutomationSettings() {
  const [simulation, setSimulation] = useState(false);
  const [enabled, setEnabled] = useState(false);
  return <div className="settings-grid">
    <article className="product-card safety-card"><div className="card-title"><ShieldCheck /><div><h2>Application safety gate</h2><p>Auto-apply is off by default in every environment.</p></div></div>
      <div className="check-row"><input aria-label="Dry-run simulation passed" id="simulation-complete" type="checkbox" checked={simulation} onChange={(event) => { setSimulation(event.target.checked); if (!event.target.checked) setEnabled(false); }} /><span><strong>Dry-run simulation passed</strong><small>Required before enablement. Simulation never presses Submit.</small></span></div>
      <div className={`check-row ${!simulation ? "disabled" : ""}`}><input aria-label="Enable automatic submission" id="auto-apply-enabled" type="checkbox" checked={enabled} disabled={!simulation} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>Enable automatic submission</strong><small>Still stops for sensitive answers, CAPTCHA, OTP, login, and unsupported flows.</small></span></div>
      {enabled ? <p className="inline-warning"><AlertTriangle size={16} /> UI preference recorded for demonstration only. Production enablement also requires the server feature flag and database policy.</p> : <p className="inline-safe"><LockKeyhole size={16} /> Submissions are currently blocked.</p>}
    </article>
    <article className="product-card"><h2>Hard limits</h2><div className="limit-list"><span>Daily applications <strong>10 / max 25</strong></span><span>Weekly applications <strong>50 / max 100</strong></span><span>Per company, per day <strong>2 / max 5</strong></span></div></article>
  </div>;
}
