import Link from "next/link";
import { ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { SectionShell } from "@/src/components/dashboard/section-shell";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";

const samples: Record<string, { title: string; company: string; location: string; type: string; skills: string[] }> = {
  "sample-northbeam-ml-engineer": { title: "Machine Learning Engineer", company: "Northbeam Labs", location: "Berlin, Germany", type: "Hybrid · Full-time", skills: ["Python", "PyTorch", "NLP"] },
  "sample-morrow-applied-ai": { title: "Applied AI Engineer", company: "Morrow Intelligence", location: "Munich, Germany", type: "Remote · Full-time", skills: ["LLMs", "Python", "RAG"] },
  "sample-aperture-nlp": { title: "Junior NLP Engineer", company: "Aperture Cloud", location: "Hamburg, Germany", type: "On-site · Full-time", skills: ["Transformers", "NLP", "SQL"] },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = samples[id];
  let stored: { title: string; company: string; location?: string | null; workplace_type?: string; employment_type?: string | null; salary_text?: string | null; status?: string; description?: string | null; job_sources?: Array<{ source_url: string; application_url?: string | null; provider: string; last_verified_at?: string | null }>; job_skills?: Array<{ skill: string }> } | null = null;
  if (!sample && /^[0-9a-f-]{36}$/i.test(id)) {
    const user = await getCurrentUser();
    const supabase = user ? await createClient() : null;
    const result = await supabase?.from("jobs").select("title,company,location,workplace_type,employment_type,salary_text,status,description,job_sources(source_url,application_url,provider,last_verified_at),job_skills(skill)").eq("id", id).maybeSingle();
    stored = result?.data ?? null;
  }
  const title = sample?.title ?? stored?.title ?? "Role unavailable";
  const company = sample?.company ?? stored?.company;
  const location = sample?.location ?? stored?.location;
  const source = stored?.job_sources?.[0];
  const skills = sample?.skills ?? stored?.job_skills?.map(({ skill }) => skill) ?? [];
  return <SectionShell eyebrow={sample ? "Preview role · sample data" : "Verified job detail"} title={title} description={company ? `${company} · ${location ?? "Location not supplied"}` : "This role is not available to the current session."}>
    <div className="settings-grid"><article className="product-card"><h2><MapPin /> Role facts</h2>{company ? <><p>{sample?.type ?? ([stored?.workplace_type, stored?.employment_type].filter(Boolean).join(" · ") || "Employment details not supplied")}</p>{stored?.salary_text ? <p>{stored.salary_text}</p> : null}<div className="tag-row">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>{stored?.description ? <p>{stored.description.slice(0, 1_500)}</p> : null}</> : <p>Sign in and open this role from your saved jobs.</p>}</article><article className="product-card"><h2><ShieldCheck /> Application safety</h2><p>No listing is submitted from this page. Review the verified source and required facts first.</p>{source?.source_url ? <a className="primary-link" href={source.source_url} target="_blank" rel="noreferrer">Open {source.provider} source <ExternalLink size={14} /></a> : <Link className="primary-link" href={sample ? "/login" : "/search"}>{sample ? "Sign in to search live roles" : "Return to search"}</Link>}</article></div>
  </SectionShell>;
}
