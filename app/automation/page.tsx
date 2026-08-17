import Link from "next/link";
import { SectionShell } from "@/src/components/dashboard/section-shell";
import { AutomationActivity } from "@/src/components/automation/automation-activity";
export default function Page(){return <SectionShell eyebrow="Automation" title="Prepared, paced, and interruptible." description="Automation is a state machine with hard limits—not a promise to apply everywhere." action={<Link className="primary-link" href="/settings/auto-apply">Safety settings</Link>}><AutomationActivity /></SectionShell>}
