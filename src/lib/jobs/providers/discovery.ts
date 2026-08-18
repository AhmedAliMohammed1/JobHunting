import { createHash } from "node:crypto";
import { z } from "zod";
import type { JobProvider, JobSearchQuery, NormalizedJob, WorkplaceType } from "@/src/types/jobs";
import { cleanText, inferWorkplaceType, normalizedJob } from "../normalize";

export type DiscoverySourceId =
  | "linkedin"
  | "indeed"
  | "stepstone"
  | "xing"
  | "glassdoor"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "personio"
  | "workday"
  | "sap-successfactors"
  | "career-page";

export const DISCOVERY_SOURCE_IDS: DiscoverySourceId[] = [
  "linkedin", "indeed", "stepstone", "xing", "glassdoor", "greenhouse", "lever",
  "ashby", "smartrecruiters", "personio", "workday", "sap-successfactors", "career-page",
];

const SOURCE_DOMAINS: Record<Exclude<DiscoverySourceId, "career-page">, string[]> = {
  linkedin: ["linkedin.com"],
  indeed: ["indeed.com", "de.indeed.com"],
  stepstone: ["stepstone.de"],
  xing: ["xing.com"],
  glassdoor: ["glassdoor.com", "glassdoor.de"],
  greenhouse: ["boards.greenhouse.io", "job-boards.greenhouse.io"],
  lever: ["jobs.lever.co"],
  ashby: ["jobs.ashbyhq.com"],
  smartrecruiters: ["jobs.smartrecruiters.com"],
  personio: ["jobs.personio.de", "jobs.personio.com"],
  workday: ["myworkdayjobs.com"],
  "sap-successfactors": ["successfactors.com"],
};

const ATS_HOSTS: Array<[RegExp, DiscoverySourceId]> = [
  [/(?:job-boards\.)?greenhouse\.io$/i, "greenhouse"],
  [/jobs\.lever\.co$/i, "lever"],
  [/jobs\.ashbyhq\.com$/i, "ashby"],
  [/jobs\.smartrecruiters\.com$/i, "smartrecruiters"],
  [/jobs\.personio\.(?:de|com)$/i, "personio"],
  [/myworkdayjobs\.com$/i, "workday"],
  [/successfactors\.com$/i, "sap-successfactors"],
];

const responseSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    content: z.string().optional().default(""),
    score: z.number().optional(),
    published_date: z.string().optional(),
  }).passthrough()).default([]),
});

interface DiscoveryResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
  publishedDate?: string;
}

interface DiscoveryOptions {
  includeDomains?: string[];
  postedWithinHours?: number;
  maxResults?: number;
}

export interface SearchDiscoveryProvider {
  id: string;
  search(query: string, options: DiscoveryOptions, signal?: AbortSignal): Promise<DiscoveryResult[]>;
}

const cache = new Map<string, { expiresAt: number; value: DiscoveryResult[] }>();

function cacheKey(query: string, options: DiscoveryOptions): string {
  return createHash("sha256").update(JSON.stringify([query, options])).digest("hex");
}

function startDate(hours: number | undefined): string | undefined {
  if (!hours) return undefined;
  return new Date(Date.now() - hours * 3_600_000).toISOString().slice(0, 10);
}

export function createTavilySearchProvider(apiKey: string, cacheTtlSeconds = 600): SearchDiscoveryProvider {
  return {
    id: "tavily",
    async search(query, options, signal) {
      const key = cacheKey(query, options);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const body: Record<string, unknown> = {
        query,
        topic: "general",
        search_depth: "basic",
        max_results: Math.min(20, Math.max(1, options.maxResults ?? 12)),
        include_answer: false,
        include_raw_content: false,
      };
      if (options.includeDomains?.length) body.include_domains = options.includeDomains;
      const after = startDate(options.postedWithinHours);
      if (after) body.start_date = after;

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Tavily returned ${response.status}`);
      const parsed = responseSchema.parse(await response.json());
      const value = parsed.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        publishedDate: result.published_date,
      }));
      cache.set(key, { expiresAt: Date.now() + cacheTtlSeconds * 1_000, value });
      return value;
    },
  };
}

function quoted(values: string[]): string {
  return values.filter(Boolean).map((value) => `"${value.replace(/"/g, "")}"`).join(" OR ");
}

function employmentTerms(types: string[]): string[] {
  const terms = new Set<string>();
  for (const type of types) {
    const value = type.toLowerCase();
    if (value.includes("working") || value.includes("werkstudent")) ["Working Student", "Werkstudent"].forEach((term) => terms.add(term));
    else if (value.includes("intern")) ["Internship", "Intern", "Praktikum"].forEach((term) => terms.add(term));
    else if (value.includes("full") || value.includes("vollzeit")) ["Full-time", "Vollzeit"].forEach((term) => terms.add(term));
    else if (value.includes("part") || value.includes("teilzeit")) ["Part-time", "Teilzeit"].forEach((term) => terms.add(term));
    else terms.add(type);
  }
  return [...terms];
}

export function buildSearchQuery(input: {
  source?: DiscoverySourceId;
  roles: string[];
  keywords: string[];
  locations: string[];
  countries: string[];
  employmentTypes: string[];
  workplaceTypes: WorkplaceType[];
  companies: string[];
}): string {
  const roleTerms = quoted([...input.roles, ...input.keywords].slice(0, 8));
  const locations = quoted([...input.locations, ...input.countries].slice(0, 6));
  const employment = quoted(employmentTerms(input.employmentTypes));
  const workplaces = quoted(input.workplaceTypes.filter((type) => type !== "unknown").map((type) => type === "onsite" ? "on-site" : type));
  const companies = quoted(input.companies);
  const pieces = [roleTerms ? `(${roleTerms})` : "jobs", locations ? `(${locations})` : "", employment ? `(${employment})` : "", workplaces ? `(${workplaces})` : "", companies ? `(${companies})` : ""];
  if (input.source === "career-page") pieces.push("(careers OR jobs OR vacancies OR stellenangebote)");
  return pieces.filter(Boolean).join(" ");
}

export function detectATS(url: string): DiscoverySourceId | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ATS_HOSTS.find(([pattern]) => pattern.test(host))?.[1];
  } catch {
    return undefined;
  }
}

export function detectJobSource(url: string): DiscoverySourceId {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const ats = detectATS(url);
    if (ats) return ats;
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (host === "indeed.com" || host.endsWith(".indeed.com")) return "indeed";
    if (host === "stepstone.de" || host.endsWith(".stepstone.de")) return "stepstone";
    if (host === "xing.com" || host.endsWith(".xing.com")) return "xing";
    if (host.includes("glassdoor.")) return "glassdoor";
  } catch {
    return "career-page";
  }
  return "career-page";
}

export function isLikelyJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const source = detectJobSource(url);
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (/\/(?:login|signin|privacy|terms|blog|news)(?:\/|$)/.test(path)) return false;
    if (source === "linkedin") return /\/jobs\/view\//.test(path);
    if (source === "indeed") return /\/viewjob|\/pagead\/|\/rc\/clk|[?&]jk=/.test(path);
    if (source === "stepstone") return /\/stellenangebote|\/job\//.test(path);
    if (source === "xing") return /\/jobs\//.test(path);
    if (source === "glassdoor") return /\/job-listing\/|\/partner\/joblisting/.test(path);
    if (["lever", "ashby"].includes(source)) return segments.length >= 2;
    if (source === "greenhouse") return /\/jobs?\//.test(path) || segments.length >= 2;
    if (source === "smartrecruiters") return segments.length >= 3;
    if (source === "personio") return /\/job\//.test(path) || segments.length >= 2;
    if (source === "workday" || source === "sap-successfactors") return /\/job|\/jobs|career|job_req_id/.test(path);
    return /\/(?:jobs?|positions?|vacancies|careers?)\/(?:[^/?#]+)?/.test(path) && !/\/(?:jobs?|careers?)\/?$/.test(parsed.pathname.toLowerCase());
  } catch {
    return false;
  }
}

function inferEmploymentType(...values: Array<string | undefined>): string | undefined {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\bwerkstudent|working[ -]?student\b/.test(text)) return "Working Student";
  if (/\bpraktikum|internship|\bintern\b/.test(text)) return "Internship";
  if (/\bvollzeit|full[ -]?time\b/.test(text)) return "Full-time";
  if (/\bteilzeit|part[ -]?time\b/.test(text)) return "Part-time";
  if (/\bcontract|befristet\b/.test(text)) return "Contract";
  return undefined;
}

function cleanResultTitle(value: string): string {
  return value.replace(/\s*[|–-]\s*(LinkedIn|Indeed(?:\.com)?|StepStone|XING|Glassdoor)\s*$/i, "").trim();
}

function isGenericCareerTitle(value: string): boolean {
  const title = value.trim().toLowerCase();
  return /^(?:careers?|jobs?|vacancies|stellenangebote)(?:\s*[|–-].*)?$/.test(title)
    || /^(?:careers?|jobs?|vacancies|stellenangebote)\s+(?:at|@)\b/.test(title)
    || /\b(?:career opportunities|join our team|company careers?|job search)\b/.test(title);
}

function extractFields(result: DiscoveryResult, source: DiscoverySourceId): { title: string; company: string; location?: string } {
  const raw = cleanResultTitle(result.title);
  if (source === "linkedin") {
    const match = raw.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+)$/i);
    if (match) return { company: match[1].trim(), title: match[2].trim(), location: match[3].trim() };
  }
  const at = raw.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return { title: at[1].trim(), company: at[2].trim() };
  const greenhouse = raw.match(/^Job Application for (.+?) at (.+)$/i);
  if (greenhouse) return { title: greenhouse[1].trim(), company: greenhouse[2].trim() };
  return { title: raw || "Job opening", company: "Company not supplied" };
}

function providerGroups(query: JobSearchQuery): Array<{ source?: DiscoverySourceId; domains?: string[] }> {
  const requested = query.providers.filter((id): id is DiscoverySourceId => DISCOVERY_SOURCE_IDS.includes(id as DiscoverySourceId));
  if (requested.length) {
    return requested.map((source) => ({ source, domains: source === "career-page" ? undefined : SOURCE_DOMAINS[source] }));
  }

  const groups: Array<{ source?: DiscoverySourceId; domains?: string[] }> = [
    { source: "linkedin", domains: SOURCE_DOMAINS.linkedin },
    { source: "indeed", domains: SOURCE_DOMAINS.indeed },
    { source: "stepstone", domains: SOURCE_DOMAINS.stepstone },
    { source: "xing", domains: SOURCE_DOMAINS.xing },
    { source: "glassdoor", domains: SOURCE_DOMAINS.glassdoor },
    { domains: ["boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com", "jobs.smartrecruiters.com", "jobs.personio.de", "jobs.personio.com", "myworkdayjobs.com", "successfactors.com"] },
  ];

  // Generic career-page discovery is useful when a company was explicitly requested,
  // but is too noisy for broad searches and can crowd out real job-detail pages.
  if (query.companies.length) groups.push({ source: "career-page" });
  return groups;
}

export function createDiscoveryJobProvider(searchProvider: SearchDiscoveryProvider): JobProvider {
  return {
    id: "web-discovery",
    name: "Public job search discovery",
    sourceType: "search-discovery",
    async search(query, signal) {
      const groups = providerGroups(query);
      const perSourceLimit = Math.min(12, Math.max(6, Math.ceil(query.limit / Math.max(1, groups.length))));
      const settled = await Promise.allSettled(groups.map(async (group) => {
        const searchQuery = buildSearchQuery({
          source: group.source,
          roles: query.roles,
          keywords: query.keywords,
          locations: query.locations,
          countries: query.countries,
          employmentTypes: query.employmentTypes,
          workplaceTypes: query.workplaceTypes,
          companies: query.companies,
        });
        return searchProvider.search(searchQuery, { includeDomains: group.domains, postedWithinHours: query.postedWithinHours, maxResults: perSourceLimit }, signal);
      }));
      if (settled.every((result) => result.status === "rejected")) throw new Error("All discovery searches failed");
      const rows = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      return rows
        .filter((result) => {
          if ((result.score ?? 1) < 0.3 || !isLikelyJobUrl(result.url)) return false;
          const source = detectJobSource(result.url);
          if (source === "career-page" && isGenericCareerTitle(cleanResultTitle(result.title))) return false;
          return true;
        })
        .map((result): NormalizedJob => {
          const source = detectJobSource(result.url);
          const fields = extractFields(result, source);
          const description = cleanText(result.content);
          const workplaceType = inferWorkplaceType(fields.location, description);
          const postedAt = result.publishedDate && Number.isFinite(Date.parse(result.publishedDate)) ? new Date(result.publishedDate).toISOString() : undefined;
          return normalizedJob({
            provider: source,
            sourceType: "search-discovery",
            externalId: result.url,
            title: fields.title,
            company: fields.company,
            location: fields.location,
            description,
            snippet: description?.slice(0, 320),
            employmentType: inferEmploymentType(fields.title, description),
            workplaceType,
            postedAt,
            sourceUrl: result.url,
            applicationUrl: result.url,
            sourceDelayHours: 0,
          });
        });
    },
  };
}
