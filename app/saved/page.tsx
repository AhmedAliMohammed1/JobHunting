import { Bookmark } from "lucide-react";
import { EmptyCard, SectionShell } from "@/src/components/dashboard/section-shell";
export default function Page(){return <SectionShell eyebrow="Library" title="Saved jobs" description="A focused shortlist with source history and freshness checks."><EmptyCard title="Your shortlist"><p className="card-empty"><Bookmark/> Save a role from Discover to compare it here. Saved jobs are never treated as active without a recent source check.</p></EmptyCard></SectionShell>}
