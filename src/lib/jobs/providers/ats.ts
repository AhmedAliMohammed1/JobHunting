import type { JobProvider, NormalizedJob } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";
import type { CompanyCareerSource } from "./career-sources";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function iso(value: unknown): string | undefined {
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

async function json(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" }, next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`ATS returned ${response.status}`);
  return response.json();
}

async function greenhouse(source: CompanyCareerSource, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const body = record(await json(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.identifier)}/jobs?content=true`, signal));
  const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
  return jobs.flatMap((row) => {
    const job = record(row); const location = record(job?.location);
    const title = text(job?.title); const url = text(job?.absolute_url); const id = String(job?.id ?? "");
    if (!title || !url || !id) return [];
    return [normalizedJob({ provider: "greenhouse", sourceType: "public-ats", externalId: id, title, company: source.company, location: text(location?.name), description: text(job?.content), postedAt: iso(job?.updated_at), sourceUrl: url, applicationUrl: url })];
  });
}

async function lever(source: CompanyCareerSource, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const body = await json(`https://api.lever.co/v0/postings/${encodeURIComponent(source.identifier)}?mode=json`, signal);
  const jobs = Array.isArray(body) ? body : [];
  return jobs.flatMap((row) => {
    const job = record(row); const categories = record(job?.categories);
    const title = text(job?.text); const url = text(job?.hostedUrl); const id = text(job?.id);
    if (!title || !url || !id) return [];
    return [normalizedJob({ provider: "lever", sourceType: "public-ats", externalId: id, title, company: source.company, location: text(categories?.location), description: text(job?.descriptionPlain) ?? text(job?.description), employmentType: text(categories?.commitment), postedAt: iso(number(job?.createdAt)), sourceUrl: url, applicationUrl: text(job?.applyUrl) ?? url })];
  });
}

async function ashby(source: CompanyCareerSource, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const body = record(await json(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.identifier)}`, signal));
  const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
  return jobs.flatMap((row) => {
    const job = record(row); const title = text(job?.title); const url = text(job?.jobUrl); const id = text(job?.id) ?? url;
    if (!title || !url || !id || job?.isListed === false) return [];
    return [normalizedJob({ provider: "ashby", sourceType: "public-ats", externalId: id, title, company: source.company, location: text(job?.location), description: text(job?.descriptionPlain) ?? text(job?.descriptionHtml), employmentType: text(job?.employmentType), postedAt: iso(job?.publishedAt), sourceUrl: url, applicationUrl: text(job?.applyUrl) ?? url })];
  });
}

async function smartRecruiters(source: CompanyCareerSource, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const body = record(await json(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.identifier)}/postings?limit=100`, signal));
  const jobs = Array.isArray(body?.content) ? body.content : [];
  return jobs.flatMap((row) => {
    const job = record(row); const location = record(job?.location); const company = record(job?.company); const employment = record(job?.typeOfEmployment);
    const title = text(job?.name); const id = text(job?.id); const url = text(job?.ref);
    if (!title || !id || !url) return [];
    const locationText = [text(location?.city), text(location?.region), text(location?.country)].filter(Boolean).join(", ") || undefined;
    return [normalizedJob({ provider: "smartrecruiters", sourceType: "public-ats", externalId: id, title, company: text(company?.name) ?? source.company, location: locationText, country: text(location?.country), employmentType: text(employment?.label), postedAt: iso(job?.releasedDate), sourceUrl: url, applicationUrl: url })];
  });
}

function xmlTag(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${name}>`, "i"));
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim() || undefined;
}

async function personio(source: CompanyCareerSource, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const base = source.careerUrl?.replace(/\/$/, "") ?? `https://${source.identifier.includes(".") ? source.identifier : `${source.identifier}.jobs.personio.de`}`;
  const response = await fetch(`${base}/xml`, { signal, headers: { Accept: "application/xml,text/xml" }, next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Personio returned ${response.status}`);
  const xml = await response.text();
  const blocks = xml.match(/<position(?:\s[^>]*)?>[\s\S]*?<\/position>/gi) ?? [];
  return blocks.flatMap((block) => {
    const id = xmlTag(block, "id"); const title = xmlTag(block, "name");
    if (!id || !title) return [];
    const office = xmlTag(block, "office"); const url = `${base}/job/${encodeURIComponent(id)}`;
    return [normalizedJob({ provider: "personio", sourceType: "public-ats", externalId: id, title, company: source.company, location: office, description: xmlTag(block, "jobDescriptions"), employmentType: xmlTag(block, "employmentType"), sourceUrl: url, applicationUrl: url })];
  });
}

async function sourceJobs(source: CompanyCareerSource, signal?: AbortSignal): Promise<NormalizedJob[]> {
  switch (source.provider) {
    case "greenhouse": return greenhouse(source, signal);
    case "lever": return lever(source, signal);
    case "ashby": return ashby(source, signal);
    case "smartrecruiters": return smartRecruiters(source, signal);
    case "personio": return personio(source, signal);
    case "workday":
    case "successfactors":
      return [];
  }
}

export function createCareerRegistryProvider(sources: CompanyCareerSource[]): JobProvider {
  return {
    id: "ats-registry",
    name: "Configured public ATS boards",
    sourceType: "public-ats",
    async search(query, signal) {
      const wantedCompanies = query.companies.map((company) => company.toLowerCase());
      const selected = wantedCompanies.length ? sources.filter((source) => wantedCompanies.some((company) => source.company.toLowerCase().includes(company))) : sources;
      const settled = await Promise.allSettled(selected.map((source) => sourceJobs(source, signal)));
      return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    },
  };
}
