import { SectionShell } from "@/src/components/dashboard/section-shell";
import { AutomationSettings } from "@/src/components/settings/automation-settings";
export default function Page(){return <SectionShell eyebrow="Safety controls" title="Auto-apply has two keys." description="A user preference alone cannot enable it: server policy, a successful simulation, fresh jobs, and an approved adapter must all agree."><AutomationSettings /></SectionShell>}
