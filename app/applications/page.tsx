import { SectionShell } from "@/src/components/dashboard/section-shell";
import { ApplicationsManager } from "@/src/components/applications/applications-manager";
export default function Page(){return <SectionShell eyebrow="Applications" title="Every application has a paper trail." description="Track each role through planning, application, interviews, and outcomes."><ApplicationsManager /></SectionShell>}
