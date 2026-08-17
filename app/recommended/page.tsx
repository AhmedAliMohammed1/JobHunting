import { SectionShell } from "@/src/components/dashboard/section-shell";
import { RecommendationsManager } from "@/src/components/jobs/recommendations-manager";
export default function Page(){return <SectionShell eyebrow="Recommended" title="Matches you can audit." description="Live provider results are ranked with deterministic, versioned scores decomposed into visible factors."><RecommendationsManager /></SectionShell>}
