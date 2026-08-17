import { SectionShell } from "@/src/components/dashboard/section-shell";
import { ProfileEditor } from "@/src/components/profile/profile-editor";
export default function Page(){return <SectionShell eyebrow="Candidate profile" title="Facts you own and can correct." description="Manual edits are authoritative. AI extraction proposes facts but cannot overwrite them."><ProfileEditor /></SectionShell>}
