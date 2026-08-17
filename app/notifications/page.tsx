import { SectionShell } from "@/src/components/dashboard/section-shell";
import { NotificationsManager } from "@/src/components/notifications/notifications-manager";
export default function Page(){return <SectionShell eyebrow="Notifications" title="Useful alerts, with delivery evidence." description="In-app alerts are deduplicated and tied to saved searches."><NotificationsManager /></SectionShell>}
