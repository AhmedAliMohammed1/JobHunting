import { BellOff } from "lucide-react";
import { EmptyCard, SectionShell } from "@/src/components/dashboard/section-shell";
export default function Page(){return <SectionShell eyebrow="Notifications" title="Useful alerts, with delivery evidence." description="Alerts are deduplicated and sent only to verified destinations."><EmptyCard title="No channel connected"><p className="card-empty"><BellOff/> Add and verify an email destination before scheduled search alerts can send.</p></EmptyCard></SectionShell>}
