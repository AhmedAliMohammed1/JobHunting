import { SectionShell } from "@/src/components/dashboard/section-shell";
import { SearchWorkspace } from "@/src/components/jobs/search-workspace";

export default function SearchPage() { return <SectionShell eyebrow="Discover" title="Search with intent, not noise." description="Describe the role in plain language, then refine structured filters. Every result is labeled with its source and freshness."><SearchWorkspace /></SectionShell>; }
