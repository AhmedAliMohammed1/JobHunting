import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Command,
  FileText,
  Gauge,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { getCurrentUser } from "@/src/lib/auth/user";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, active: true, href: "/dashboard" },
  { label: "Discover", icon: Radar, href: "/search" },
  { label: "Saved jobs", icon: Bookmark, href: "/saved" },
  { label: "Applications", icon: BriefcaseBusiness, href: "/applications" },
  { label: "Automation", icon: Gauge, href: "/automation" },
];

const workspace = [
  { label: "My profile", icon: UserRound, href: "/profile" },
  { label: "Documents", icon: FileText, href: "/cv" },
  { label: "Search profiles", icon: Search, href: "/search-profiles" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

const jobs = [
  {
    id: "sample-northbeam-ml-engineer",
    initials: "NB",
    company: "Northbeam Labs",
    title: "Machine Learning Engineer",
    location: "Berlin, Germany",
    type: "Hybrid · Full-time",
    time: "26 min ago",
    score: 94,
    tone: "violet",
    skills: ["Python", "PyTorch", "NLP"],
    source: "Sample career page",
  },
  {
    id: "sample-morrow-applied-ai",
    initials: "MI",
    company: "Morrow Intelligence",
    title: "Applied AI Engineer",
    location: "Munich, Germany",
    type: "Remote · Full-time",
    time: "1 hr ago",
    score: 89,
    tone: "blue",
    skills: ["LLMs", "Python", "RAG"],
    source: "Sample ATS record",
  },
  {
    id: "sample-aperture-nlp",
    initials: "AC",
    company: "Aperture Cloud",
    title: "Junior NLP Engineer",
    location: "Hamburg, Germany",
    type: "On-site · Full-time",
    time: "2 hrs ago",
    score: 84,
    tone: "orange",
    skills: ["Transformers", "NLP", "SQL"],
    source: "Delayed-feed example",
  },
];

function loginFor(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function Logo() {
  return (
    <Link className="brand" href="/" aria-label="JobHunter AI home">
      <span className="brand-mark">
        <Command size={18} strokeWidth={2.4} />
      </span>
      <span>JobHunter</span>
      <span className="brand-ai">AI</span>
    </Link>
  );
}

function NavItem({
  item,
}: {
  item: (typeof navigation)[number] | (typeof workspace)[number];
}) {
  const Icon = item.icon;
  return (
    <Link
      className={`nav-item ${"active" in item && item.active ? "active" : ""}`}
      href={loginFor(item.href)}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </Link>
  );
}

export default async function Home() {
  await connection();
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Logo />

        <nav className="nav-groups" aria-label="Primary navigation">
          <div className="nav-group">
            <span className="nav-label">Workspace</span>
            {navigation.map((item) => (
              <NavItem item={item} key={item.label} />
            ))}
          </div>

          <div className="nav-group">
            <span className="nav-label">Manage</span>
            {workspace.map((item) => (
              <NavItem item={item} key={item.label} />
            ))}
          </div>
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-card-icon">
            <Sparkles size={18} />
          </div>
          <p>Create your private workspace</p>
          <span>This public tour uses sample roles and a fictional candidate profile.</span>
          <Link href="/register">Create an account</Link>
        </div>

        <Link className="user-menu" href="/login">
          <span className="avatar">?</span>
          <span>
            <strong>Not signed in</strong>
            <small>Sign in to open your workspace</small>
          </span>
          <ChevronRight size={18} />
        </Link>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="status-pill">
            <span className="status-dot" />
            Public product tour · sample data
          </div>
          <div className="topbar-actions">
            <Link className="pause-button" href="/login">Sign in</Link>
            <Link className="primary-button" href="/register"><UserRound size={17} /> Create account</Link>
          </div>
        </header>

        <div className="content-wrap">
          <section className="auth-state-banner" role="status">
            <ShieldCheck size={20} />
            <p><strong>You are viewing a public product tour.</strong> You are not signed in, and every role, count, and activity item below is sample data.</p>
            <Link href="/login">Sign in to your workspace <ChevronRight size={15} /></Link>
          </section>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">Public demo</p>
              <h1>Explore JobHunter AI before signing in.</h1>
              <p className="welcome-copy">
                See how the private workspace works using a fictional profile and representative roles.
              </p>
            </div>
            <Link className="primary-button" href={loginFor("/search")}>
              <WandSparkles size={18} />
              Sign in to search
            </Link>
          </section>

          <section className="metrics-grid" aria-label="Job search summary">
            <article className="metric-card featured">
              <span className="metric-icon"><Radar size={19} /></span>
              <span className="metric-label">Sample fresh matches</span>
              <strong>32</strong>
              <small><b>+12</b> since yesterday</small>
              <span className="metric-art" aria-hidden="true" />
            </article>
            <article className="metric-card">
              <span className="metric-icon violet"><Sparkles size={19} /></span>
              <span className="metric-label">Sample strong matches</span>
              <strong>7</strong>
              <small>Above your 80% threshold</small>
            </article>
            <article className="metric-card">
              <span className="metric-icon orange"><BriefcaseBusiness size={19} /></span>
              <span className="metric-label">Sample applications</span>
              <strong>4</strong>
              <small><b>2</b> awaiting a response</small>
            </article>
            <article className="metric-card">
              <span className="metric-icon teal"><CalendarClock size={19} /></span>
              <span className="metric-label">Sample interviews</span>
              <strong>1</strong>
              <small>Thursday at 10:30</small>
            </article>
          </section>

          <div className="dashboard-grid">
            <section className="opportunities-card">
              <div className="section-heading">
                <div>
                  <div className="heading-with-count">
                    <h2>Best new opportunities</h2>
                    <span>3</span>
                  </div>
                  <p>Example rankings based on a fictional candidate profile.</p>
                </div>
                <Link href={loginFor("/recommended")}>Sign in to view matches <ChevronRight size={16} /></Link>
              </div>

              <div className="job-list">
                {jobs.map((job) => (
                  <article className="job-row" key={job.title}>
                    <div className={`company-logo ${job.tone}`}>{job.initials}</div>
                    <div className="job-main">
                      <div className="job-title-line">
                        <h3>{job.title}</h3>
                        <span className="match-score">{job.score}% match</span>
                      </div>
                      <p className="company-name">
                        {job.company}
                        <span>·</span>
                        <span className="verified"><Check size={11} /> Sample</span>
                      </p>
                      <div className="job-meta">
                        <span><MapPin size={14} />{job.location}</span>
                        <span><Building2 size={14} />{job.type}</span>
                        <span><Clock3 size={14} />{job.time}</span>
                      </div>
                      <div className="job-footer">
                        <div className="skill-list">
                          {job.skills.map((skill) => <span key={skill}>{skill}</span>)}
                        </div>
                        <small>{job.source}</small>
                      </div>
                    </div>
                    <div className="job-actions">
                    <Link className="save-button" aria-label={`Sign in to save ${job.title}`} href="/login"><Bookmark size={17} /></Link>
                      <Link className="apply-button" href={`/jobs/${job.id}`}>Review role</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="insights-column">
              <section className="agent-card">
                <div className="section-heading compact">
                  <div>
                    <span className="tiny-label">Agent activity</span>
                    <h2>Working quietly for you</h2>
                  </div>
                  <span className="live-chip"><span /> Example</span>
                </div>
                <div className="scan-ring">
                  <div>
                    <strong>1,248</strong>
                    <span>roles scanned</span>
                  </div>
                </div>
                <div className="agent-stats">
                  <span><b>6</b> sources healthy</span>
                  <span><b>14m</b> next search</span>
                </div>
                <Link className="secondary-button" href={loginFor("/automation")}>Sign in for activity</Link>
              </section>

              <section className="attention-card">
                <div className="attention-icon"><ShieldCheck size={19} /></div>
                <div>
                  <span className="tiny-label">Example checkpoint</span>
                  <h3>Visa sponsorship answer</h3>
                  <p>One application is paused until you confirm this sensitive detail.</p>
                  <Link href={loginFor("/applications")}>Sign in to review <ChevronRight size={15} /></Link>
                </div>
              </section>

              <section className="coach-card">
                <MessageSquareText size={19} />
                <div>
                  <span className="tiny-label">Match insight</span>
                  <p>Roles mentioning <strong>RAG systems</strong> are matching your profile 18% better this week.</p>
                </div>
              </section>
            </aside>
          </div>

          <section className="trust-strip">
            <ShieldCheck size={18} />
            <p><strong>You stay in control.</strong> Auto Apply is off by default, sensitive answers are never inferred, and every action is recorded.</p>
            <Link href={loginFor("/settings/auto-apply")}>Sign in to configure safety</Link>
          </section>
        </div>
      </section>
    </main>
  );
}
