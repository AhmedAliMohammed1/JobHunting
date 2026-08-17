import { SectionShell } from "@/src/components/dashboard/section-shell";
import { SavedSearchesManager } from "@/src/components/searches/saved-searches-manager";
export default function Page(){return <SectionShell eyebrow="Saved searches" title="Turn intent into a repeatable search." description="Profiles combine roles, locations, freshness, match thresholds, and notification cadence."><SavedSearchesManager /></SectionShell>}
