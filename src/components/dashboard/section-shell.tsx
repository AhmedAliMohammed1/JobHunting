import Link from "next/link";
import { Bell, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "@/src/components/auth/sign-out-button";
import { WorkspaceSidebar } from "./workspace-sidebar";

export function SectionShell({ eyebrow, title, description, children, action }: { eyebrow: string; title: string; description: string; children: ReactNode; action?: ReactNode }) {
  return <div className="app-shell workspace-shell">
    <WorkspaceSidebar />
    <main className="main-panel section-page workspace-main">
      <header className="section-header workspace-topbar">
        <span className="status-pill"><span className="status-dot" /> Private workspace</span>
        <nav><Link href="/notifications" aria-label="Open notifications"><Bell size={17} /> Notifications</Link><span className="safety-chip"><ShieldCheck size={15} /> Control stays with you</span><SignOutButton /></nav>
      </header>
      <section className="section-hero"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</section>
      <section className="section-content">{children}</section>
    </main>
  </div>;
}

export function EmptyCard({ title, children }: { title: string; children: ReactNode }) {
  return <article className="product-card"><h2>{title}</h2><div>{children}</div></article>;
}
