import Link from "next/link";
import { SectionShell } from "@/src/components/dashboard/section-shell";
import { DashboardOverview } from "@/src/components/dashboard/dashboard-overview";

export default function DashboardPage() {
  return <SectionShell eyebrow="Your private workspace" title="Find your next role with evidence." description="Every workflow below is connected to your account and keeps automation gated by explicit safety controls." action={<Link className="primary-link" href="/search">Search jobs</Link>}><DashboardOverview /></SectionShell>;
}
