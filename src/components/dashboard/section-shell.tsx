import Link from "next/link";
import { ArrowLeft, Command, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "@/src/components/auth/sign-out-button";

export function SectionShell({ eyebrow, title, description, children, action }: { eyebrow: string; title: string; description: string; children: ReactNode; action?: ReactNode }) {
  return <main className="section-page">
    <header className="section-header">
      <Link className="section-brand" href="/dashboard"><Command size={18} /> JobHunter <span>AI</span></Link>
      <nav><Link href="/dashboard"><ArrowLeft size={16} /> Dashboard</Link><span className="safety-chip"><ShieldCheck size={15} /> Control stays with you</span><SignOutButton /></nav>
    </header>
    <section className="section-hero"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</section>
    <section className="section-content">{children}</section>
  </main>;
}

export function EmptyCard({ title, children }: { title: string; children: ReactNode }) {
  return <article className="product-card"><h2>{title}</h2><div>{children}</div></article>;
}
