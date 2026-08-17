import { SectionShell } from "@/src/components/dashboard/section-shell";
import { SavedJobsManager } from "@/src/components/jobs/saved-jobs-manager";
export default function Page(){return <SectionShell eyebrow="Library" title="Saved jobs" description="A focused shortlist with source history and freshness checks."><SavedJobsManager /></SectionShell>}
