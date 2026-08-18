import { createHash } from "node:crypto";
import { z } from "zod";
import type { JobProvider, JobSearchQuery, NormalizedJob, WorkplaceType } from "@/src/types/jobs";
import { cleanText, inferWorkplaceType, normalizedJob } from "../normalize";
import { inferDiscoveryPostedAt } from "../discovery-metadata";
import { canonicalDiscoveryJobUrl } from "../discovery-url";

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
  linkedin: ["linkedin.com", "de.linkedin.com"],
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

const SOURCE_SEARCH_LABELS: Partial<Record<DiscoverySourceId, string>> = {
  linkedin: "LinkedIn Jobs",
  indeed: "Indeed Jobs",
  stepstone: "StepStone Jobs",
  xing: "XING Jobs",
  glassdoor: "Glassdoor Jobs",
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
  employmentType?: string;
  seniority?: string;
}

interface DiscoveryOptions {
  includeDomains?: string[];
  postedWithinHours?: number;
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
}

interface DiscoveryGroup {
  source?: DiscoverySourceId;
  domains?: string[];
}

interface DiscoveryQueryInput {
  source?: DiscoverySourceId;
  roles: string[];
  keywords: string[];
  locations: string[];
  countries: string[];
  employmentTypes: string[];
  workplaceTypes: WorkplaceType[];
  companies: string[];
}

export interface SearchDiscoveryProvider {
  id: string;
  search(query: string, options: DiscoveryOptions, signal?: AbortSignal): Promise<DiscoveryResult[]>;
}

const cache = new Map<string, { expiresAt: number; value: DiscoveryResult[] }>();
const ADVANCED_DISCOVERY_SOURCES = new Set<DiscoverySourceId>(["linkedin", "indeed", "glassdoor"]);
const FALLBACK_DISCOVERY_SOURCES = new Set<DiscoverySourceId>(["linkedin", "indeed", "stepstone", "xing", "glassdoor"]);

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
        search_depth: options.searchDepth ?? "basic",
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

export function buildSearchQuery(input: DiscoveryQueryInput): string {
  const roleTerms = quoted([...input.roles, ...input.keywords].slice(0, 8));
  const locations = quoted([...input.locations, ...input.countries].slice(0, 6));
  const employment = quoted(employmentTerms(input.employmentTypes));
  const workplaces = quoted(input.workplaceTypes.filter((type) => type !== "unknown").map((type) => type === "onsite" ? "on-site" : type));
  const companies = quoted(input.companies);
  const pieces = [roleTerms ? `(${roleTerms})` : "jobs", locations ? `(${locations})` : "", employment ? `(${employment})` : "", workplaces ? `(${workplaces})` : "", companies ? `(${companies})` : ""];
  if (input.source === "career-page") pieces.push("(careers OR jobs OR vacancies OR stellenangebote)");
  return pieces.filter(Boolean).join(" ");
}

function buildNaturalSearchQuery(input: DiscoveryQueryInput): string {
  const roleTerms = quoted([...input.roles, ...input.keywords].slice(0, 6));
  const locations = [...input.locations, ...input.countries].filter(Boolean).slice(0, 4).join(" ");
  const employment = employmentTerms(input.employmentTypes).slice(0, 3).join(" ");
  const workplaces = input.workplaceTypes.filter((type) => type !== "unknown").map((type) => type === "onsite" ? "on-site" : type).join(" ");
  return [roleTerms ? `(${roleTerms})` : "job", "job opening", locations, employment, workplaces, input.companies.join(" ")].filter(Boolean).join(" ");
}

function isGermanSearch(input: DiscoveryQueryInput): boolean {
  const values = [...input.locations, ...input.countries].map((value) => value.trim().toLowerCase());
  return values.some((value) => value === "de" || value.includes("germany") || value.includes("deutschland"));
}

function detailPageOperator(source: DiscoverySourceId, input: DiscoveryQueryInput): string | undefined {
  const german = isGermanSearch(input);
  if (source === "linkedin") return german ? "site:de.linkedin.com/jobs/view" : "site:linkedin.com/jobs/view";
  if (source === "indeed") return german ? "site:de.indeed.com/viewjob" : "site:indeed.com/viewjob";
  if (source === "glassdoor") return german ? "site:glassdoor.de/job-listing" : "site:glassdoor.com/job-listing";
  return undefined;
}

function buildSourceFallbackQuery(source: DiscoverySourceId, input: DiscoveryQueryInput): string {
  const target = detailPageOperator(source, input) ?? SOURCE_SEARCH_LABELS[source] ?? source;
  const roles = quoted(input.roles.slice(0, 5));
  const keywords = input.keywords.slice(0, 3).join(" ");
  const locations = [...input.locations, ...input.countries].filter(Boolean).slice(0, 4).join(" ");
  const employment = employmentTerms(input.employmentTypes).slice(0, 3).join(" ");
  const workplaces = input.workplaceTypes.filter((type) => type !== "unknown").map((type) => type === "onsite" ? "on-site" : type).join(" ");
  return [target, roles || input.keywords[0] || "job", keywords, locations, employment, workplaces, input.companies.join(" ")].filter(Boolean).join(" ");
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
    if (source === "stepstone") return /\/stellenangebote--[^/?#]+\d{5,}/.test(path) || /\/job\/[^/?#]+/.test(path);
    if (source === "xing") return /\/jobs\/[^/?#]*-\d{6,}(?:[/?#]|$)/.test(path);
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
  return value.replace(/\s*[|–-]\s*(LinkedIn|Indeed(?:\.com)?|StepStone|XING(?: Jobs)?|Glassdoor)\s*$/i, "").trim();
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
    const match = raw.match(/^(.+?)\s+(?:hiring|sucht)\s+(.+?)\s+in\s+(.+)$/i);
    if (match) return { company: match[1].trim(), title: match[2].trim(), location: match[3].trim() };
  }
  if (source === "stepstone") {
    const match = raw.match(/^(.+?)\s+-\s+Job bei der Firma\s+(.+?)\s+in\s+(.+)$/i);
    if (match) return { title: match[1].trim(), company: match[2].trim(), location: match[3].trim() };
  }
  if (source === "xing") {
    const match = raw.match(/^(.+?)\s+in\s+([^|]+)$/i);
    if (match) return { title: match[1].trim(), company: "Company not supplied", location: match[2].trim() };
  }
  const at = raw.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return { title: at[1].trim(), company: at[2].trim() };
  const greenhouse = raw.match(/^Job Application for (.+?) at (.+)$/i);
  if (greenhouse) return { title: greenhouse[1].trim(), company: greenhouse[2].trim() };
  return { title: raw || "Job opening", company: "Company not supplied" };
}

function providerGroups(query: JobSearchQuery): DiscoveryGroup[] {
  const requested = query.providers.filter((id): id is DiscoverySourceId => DISCOVERY_SOURCE_IDS.includes(id as DiscoverySourceId));
  if (requested.length) {
    return requested.map((source) => ({ source, domains: source === "career-page" ? undefined : SOURCE_DOMAINS[source] }));
  }

  const groups: DiscoveryGroup[] = [
    { source: "linkedin", domains: SOURCE_DOMAINS.linkedin },
    { source: "indeed", domains: SOURCE_DOMAINS.indeed },
    { source: "stepstone", domains: SOURCE_DOMAINS.stepstone },
    { source: "xing", domains: SOURCE_DOMAINS.xing },
    { source: "glassdoor", domains: SOURCE_DOMAINS.glassdoor },
    { domains: ["boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com", "jobs.smartrecruiters.com", "jobs.personio.de", "jobs.personio.com", "myworkdayjobs.com", "successfactors.com"] },
  ];

  if (query.companies.length) groups.push({ source: "career-page" });
  return groups;
}

function validDiscoveryResult(result: DiscoveryResult, expectedSource?: DiscoverySourceId): boolean {
  if ((result.score ?? 1) < 0.12 || !isLikelyJobUrl(result.url)) return false;
  const source = detectJobSource(result.url);
  if (expectedSource && source !== expectedSource) return false;
  if (!expectedSource && !detectATS(result.url)) return false;
  return !(source === "career-page" && isGenericCareerTitle(cleanResultTitle(result.title)));
}

function mergeRows(rows: DiscoveryResult[]): DiscoveryResult[] {
  const byKey = new Map<string, DiscoveryResult>();
  for (const row of rows) {
    const canonical = canonicalDiscoveryJobUrl(row.url);
    const key = canonical?.sourceId ? `${detectJobSource(row.url)}:${canonical.sourceId}` : canonical?.url ?? row.url;
    const existing = byKey.get(key);
    const score = (value: DiscoveryResult) => (value.publishedDate ? 4 : 0) + Math.min(value.content?.length ?? 0, 800) / 100 + (value.score ?? 0);
    if (!existing || score(row) >= score(existing)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

export function createDiscoveryJobProvider(searchProvider: SearchDiscoveryProvider): JobProvider {
  return {
    id: "web-discovery",
    name: "Public job search discovery",
    sourceType: "search-discovery",
    async search(query, signal) {
      const groups = providerGroups(query);
      const perSourceLimit = Math.min(20, Math.max(12, Math.ceil(query.limit / Math.max(1, groups.length)) * 2));
      const settled = await Promise.allSettled(groups.map(async (group) => {
        const input: DiscoveryQueryInput = {
          source: group.source,
          roles: query.roles,
          keywords: query.keywords,
          locations: query.locations,
          countries: query.countries,
          employmentTypes: query.employmentTypes,
          workplaceTypes: query.workplaceTypes,
          companies: query.companies,
        };
        const advanced = group.source ? ADVANCED_DISCOVERY_SOURCES.has(group.source) : false;
        const searchQuery = advanced ? buildNaturalSearchQuery(input) : buildSearchQuery(input);
        const primaryRows = await searchProvider.search(searchQuery, {
          includeDomains: group.domains,
          postedWithinHours: query.postedWithinHours,
          maxResults: group.source ? perSourceLimit : Math.min(12, perSourceLimit),
          searchDepth: advanced ? "advanced" : "basic",
        }, signal);

        let validRows = primaryRows.filter((result) => validDiscoveryResult(result, group.source));
        const recoveryThreshold = group.source ? Math.min(6, Math.ceil(perSourceLimit / 3)) : 0;
        if (group.source && FALLBACK_DISCOVERY_SOURCES.has(group.source) && validRows.length < recoveryThreshold) {
          const fallbackRows = await searchProvider.search(buildSourceFallbackQuery(group.source, input), {
            postedWithinHours: query.postedWithinHours,
            maxResults: perSourceLimit,
            searchDepth: advanced ? "advanced" : "basic",
          }, signal);
          validRows = mergeRows([...validRows, ...fallbackRows.filter((result) => validDiscoveryResult(result, group.source))]);
        }
        return validRows;
      }));
      if (settled.every((result) => result.status === "rejected")) throw new Error("All discovery searches failed");
      const rows = mergeRows(settled.flatMap((result) => result.status === "fulfilled" ? result.value : []));
      return rows.map((result): NormalizedJob => {
        const source = detectJobSource(result.url);
        const fields = extractFields(result, source);
        const description = cleanText(result.content);
        const workplaceType = inferWorkplaceType(fields.location, description);
        const postedAt = inferDiscoveryPostedAt(result.publishedDate, result.content);
        return normalizedJob({
          provider: source,
          sourceType: "search-discovery",
          externalId: result.url,
          title: fields.title,
          company: fields.company,
          location: fields.location,
          description,
          snippet: description?.slice(0, 320),
          employmentType: result.employmentType ?? inferEmploymentType(fields.title, description),
          seniority: result.seniority,
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
