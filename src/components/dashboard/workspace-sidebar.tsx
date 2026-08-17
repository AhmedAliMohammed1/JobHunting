"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Command,
  FileText,
  Gauge,
  LayoutDashboard,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

const primaryNavigation = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Discover", icon: Radar, href: "/search" },
  { label: "Recommendations", icon: Sparkles, href: "/recommended" },
  { label: "Saved jobs", icon: Bookmark, href: "/saved" },
  { label: "Applications", icon: BriefcaseBusiness, href: "/applications" },
  { label: "Automation", icon: Gauge, href: "/automation" },
];

const manageNavigation = [
  { label: "My profile", icon: UserRound, href: "/profile" },
  { label: "CV documents", icon: FileText, href: "/cv" },
  { label: "Search profiles", icon: Search, href: "/search-profiles" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  if (href === "/settings") return pathname === href || pathname.startsWith("/settings/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar() {
  const pathname = usePathname();
  return <aside className="sidebar workspace-sidebar">
    <Link className="brand" href="/dashboard" aria-label="JobHunter AI dashboard">
      <span className="brand-mark"><Command size={18} strokeWidth={2.4} /></span>
      <span>JobHunter</span><span className="brand-ai">AI</span>
    </Link>

    <nav className="nav-groups" aria-label="Workspace navigation">
      <div className="nav-group">
        <span className="nav-label">Workspace</span>
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} aria-current={active ? "page" : undefined} title={item.label} key={item.href}><Icon size={18} /><span>{item.label}</span></Link>;
        })}
      </div>
      <div className="nav-group">
        <span className="nav-label">Manage</span>
        {manageNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} aria-current={active ? "page" : undefined} title={item.label} key={item.href}><Icon size={18} /><span>{item.label}</span></Link>;
        })}
      </div>
    </nav>

    <div className="sidebar-card workspace-sidebar-card">
      <div className="sidebar-card-icon"><ShieldCheck size={18} /></div>
      <p>Your private workspace</p>
      <span>Saved roles, applications, recommendations, and automation controls stay tied to your account.</span>
      <Link href="/settings">Review workspace settings</Link>
    </div>

    <Link className="user-menu workspace-user" href="/profile">
      <span className="avatar"><UserRound size={16} /></span>
      <span><strong>Signed-in workspace</strong><small>Open your profile</small></span>
    </Link>
  </aside>;
}
