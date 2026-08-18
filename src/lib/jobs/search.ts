import { log } from "@/src/lib/observability/logger";
import type { JobSearchQuery, NormalizedJob, ProviderSearchResult } from "@/src/types/jobs";
import { deduplicateJobs } from "./deduplicate";
import { withFreshness } from "./freshness";
import { fetchPublicJobPageMetadata } from "./job-page-metadata";
import { configuredJobProviders } from "./providers";
import { withRetry } from "./retry";

export interface AggregatedSearchResult {
  jobs: NormalizedJob[];
  providers: ProviderSearchResult[];
  partial: boolean;
  totalMatches: number;
  sourceBreakdown: Record<string, number>;
}

const PRIORITY_JOB_SOURCES = new Map<string, number>([
  ["linkedin", 1],
  ["indeed", 0.98],
  ["stepstone", 0.97],
  ["xing", 0.96],
  ["glassdoor", 0.9],
]);

const MAX_DISCOVERY_METADATA_ENRICHMENTS = 50;
const DISCOVERY_METADATA_CONCURRENCY = 12;

const GENERIC_ROLE_TOKENS = new Set([
  "engineer", "engineering", "developer", "software", "system", "systems", "specialist", "consultant",
  "senior", "junior", "lead", "staff", "principal", "manager", "intern", "working", "student",
]);

const ROLE_OCCUPATION_TOKENS = [
  "engineer", "developer", "architect", "tester", "specialist", "consultant", "ingenieur", "entwickler",
  "softwareentwickler", "firmwareentwickler", "entwicklungsingenieur", "testingenieur", "architekt",
];

const COUNTRY_ALIASES: Record<string, string[]> = {
  germany: ["germany", "deutschland", "de"],
  egypt: ["egypt", "ägypten", "eg"],
  austria: ["austria", "österreich", "at"],
  switzerland: ["switzerland", "schweiz", "suisse", "svizzera", "ch"],
  france: ["france", "frankreich", "fr"],
  netherlands: ["netherlands", "niederlande", "holland", "nl"],
  belgium: ["belgium", "belgien", "be"],
  poland: ["poland", "polen", "pl"],
  czechia: ["czechia", "czech republic", "tschechien", "cz"],
  denmark: ["denmark", "dänemark", "dk"],
  sweden: ["sweden", "schweden", "se"],
  norway: ["norway", "norwegen", "no"],
  finland: ["finland", "finnland", "fi"],
  italy: ["italy", "italien", "it"],
  spain: ["spain", "spanien", "es"],
  portugal: ["portugal", "pt"],
  ireland: ["ireland", "irland", "ie"],
  "united kingdom": ["united kingdom", "great britain", "uk", "gb"],
  "united states": ["united states", "usa", "us"],
};

const COUNTRY_LOCATION_HINTS: Record<string, string[]> = {
  germany: [
    "berlin", "munich", "münchen", "hamburg", "bremen", "hannover", "frankfurt", "stuttgart", "cologne", "köln",
    "düsseldorf", "dortmund", "essen", "leipzig", "dresden", "nuremberg", "nürnberg", "erlangen", "ingolstadt",
    "darmstadt", "ulm", "aachen", "karlsruhe", "regensburg", "potsdam", "mannheim", "heidelberg", "wolfsburg",
    "braunschweig", "saarbrücken", "jena", "bielefeld", "bochum", "bonn", "würzburg", "mainz", "wiesbaden",
    "freiburg", "bavaria", "bayern", "hesse", "hessen", "saxony", "sachsen", "lower saxony", "niedersachsen",
    "north rhine westphalia", "nordrhein westfalen", "nrw", "baden württemberg", "thuringia", "thüringen",
    "schleswig holstein", "saxony anhalt", "sachsen anhalt", "brandenburg", "saarland", "mecklenburg vorpommern",
  ],
  egypt: [
    "cairo", "giza", "alexandria", "new cairo", "nasr city", "maadi", "smart village", "6th of october",
    "sixth of october", "sheikh zayed", "heliopolis",
  ],
};

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N}+#.]+/gu, " ").replace(/\s+/g, " ").trim() ?? "";
}

function containsPhrase(value: string, phrase: string): boolean {
  const needle = normalized(phrase);
  if (!needle) return false;
  return ` ${normalized(value)} `.includes(` ${needle} `);
}

function matchesSearchPhrases(searchableValue: string, phrases: string[]): boolean {
  if (!phrases.length) return true;
  const searchable = normalized(searchableValue);
  const padded = ` ${searchable} `;
  return phrases.some((phrase) => {
    const tokens = normalized(phrase).split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => padded.includes(` ${token} `));
  });
}

function conceptAppearsInToken(token: string, concept: string): boolean {
  return token === concept || (concept.length >= 5 && token.includes(concept));
}

function distinctiveRoleConcepts(phrases: string[]): string[] {
  return [...new Set(
    phrases.flatMap((phrase) => normalized(phrase).split(/\s+/).filter((token) => token && !GENERIC_ROLE_TOKENS.has(token))),
  )];
}

function titleHasOccupation(title: string): boolean {
  const tokens = normalized(title).split(/\s+/).filter(Boolean);
  return tokens.some((token) => ROLE_OCCUPATION_TOKENS.some((occupation) => conceptAppearsInToken(token, occupation)));
}

function matchesRoleTitle(searchableValue: string, phrases: string[]): boolean {
  if (!phrases.length) return true;
  if (matchesSearchPhrases(searchableValue, phrases)) return true;

  const titleTokens = normalized(searchableValue).split(/\s+/).filter(Boolean);
  if (!titleTokens.length) return false;

  const distinctive = distinctiveRoleConcepts(phrases);
  if (!distinctive.length) return false;

  const distinctiveMatches = distinctive.filter((concept) => titleTokens.some((token) => conceptAppearsInToken(token, concept)));
  if (!distinctiveMatches.length) return false;

  return titleHasOccupation(searchableValue) || distinctiveMatches.length >= 2;
}

function matchesRole(job: NormalizedJob, phrases: string[]): boolean {
  if (matchesRoleTitle(`${job.title} ${job.seniority ?? ""}`, phrases)) return true;
  if (!phrases.length || !titleHasOccupation(job.title)) return false;

  const distinctive = distinctiveRoleConcepts(phrases);
  if (!distinctive.length) return false;
  const context = normalized([job.title, job.description, ...job.skills].filter(Boolean).join(" "));
  return distinctive.some((concept) => context.split(/\s+/).some((token) => conceptAppearsInToken(token, concept)));
}

function matchesAny(value: string, candidates: string[]): boolean {
  return !candidates.length || candidates.some((candidate) => value.includes(normalized(candidate)));
}

function discoveryUnknown(job: NormalizedJob, value: string | undefined): boolean {
  return job.sourceType === "search-discovery" && !normalized(value);
}

function canonicalCountry(value: string): string {
  const clean = normalized(value);
  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.some((alias) => normalized(alias) === clean)) return canonical;
  }
  return clean;
}

function locationMentionsCountry(location: string, canonical: string): boolean {
  const aliases = COUNTRY_ALIASES[canonical] ?? [canonical];
  return aliases.filter((alias) => normalized(alias).length > 2).some((alias) => containsPhrase(location, alias));
}

function detectedCountryFromLocation(location: string | undefined): string | undefined {
  const value = normalized(location);
  if (!value) return undefined;

  for (const canonical of Object.keys(COUNTRY_ALIASES)) {
    if (locationMentionsCountry(value, canonical)) return canonical;
  }
  for (const [canonical, hints] of Object.entries(COUNTRY_LOCATION_HINTS)) {
    if (hints.some((hint) => containsPhrase(value, hint))) return canonical;
  }
  return undefined;
}

function displayCountry(canonical: string | undefined): string | undefined {
  if (!canonical) return undefined;
  if (canonical === "germany") return "Germany";
  if (canonical === "egypt") return "Egypt";
  if (canonical === "united kingdom") return "United Kingdom";
  if (canonical === "united states") return "United States";
  return canonical.charAt(0).toUpperCase() + canonical.slice(1);
}

function matchesCountryFilter(job: NormalizedJob, countries: string[]): boolean {
  if (!countries.length) return true;
  const targets = countries.map(canonicalCountry);
  const explicitCountry = normalized(job.country);
  const location = normalized(`${job.location ?? ""} ${job.city ?? ""}`);

  if (explicitCountry) {
    const explicitCanonical = canonicalCountry(explicitCountry);
    return targets.includes(explicitCanonical)
      || targets.some((target) => (COUNTRY_ALIASES[target] ?? [target]).some((alias) => normalized(alias) === explicitCountry));
  }

  const detected = detectedCountryFromLocation(location);
  if (detected) return targets.includes(detected);

  // Major-board discovery queries are already country-scoped. A public result
  // frequently exposes only a city (or no location) until the destination page
  // is opened. Keep it unless we can positively identify a conflicting country.
  if (job.sourceType === "search-discovery") return true;
  return false;
}

function inferredCountryFromLocation(location: string | undefined): string | undefined {
  return displayCountry(detectedCountryFromLocation(location));
}

function richerLocation(current: string | undefined, incoming: string | undefined): string | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  const currentCountry = detectedCountryFromLocation(current);
  const incomingCountry = detectedCountryFromLocation(incoming);
  if (!currentCountry && incomingCountry) return incoming;
  if (normalized(incoming).includes(normalized(current)) && incoming.length > current.length) return incoming;
  return current;
}

type FilterReason = "role" | "keyword" | "location" | "country" | "workplace" | "employment" | "experience" | "company" | "excluded_company" | "provider" | "date" | "salary";

function jobFilterReason(job: NormalizedJob, query: JobSearchQuery, now = Date.now()): FilterReason | undefined {
  if (!matchesRole(job, query.roles)) return "role";
  if (!matchesSearchPhrases([job.title, job.company, job.description, ...job.skills].filter(Boolean).join(" "), query.keywords)) return "keyword";

  const location = normalized(`${job.location ?? ""} ${job.city ?? ""} ${job.country ?? ""}`);
  if (query.locations.length && !location && job.sourceType !== "search-discovery") return "location";
  if (location && !matchesAny(location, query.locations)) return "location";
  if (!matchesCountryFilter(job, query.countries)) return "country";

  if (query.workplaceTypes.length && !(job.workplaceType === "unknown" && job.sourceType === "search-discovery") && !query.workplaceTypes.includes(job.workplaceType)) return "workplace";
  if (!discoveryUnknown(job, job.employmentType) && !matchesAny(normalized(job.employmentType), query.employmentTypes)) return "employment";
  if (!discoveryUnknown(job, job.seniority) && !matchesAny(normalized(job.seniority), query.experienceLevels)) return "experience";
  const companyKnown = !/^(?:company not supplied|unknown company)$/i.test(job.company);
  if (query.companies.length && companyKnown && !matchesAny(normalized(job.company), query.companies)) return "company";
  if (query.companies.length && !companyKnown && job.sourceType !== "search-discovery") return "company";
  if (query.excludedCompanies.some((company) => normalized(job.company).includes(normalized(company)))) return "excluded_company";
  if (query.providers.length && !query.providers.includes(job.provider)) return "provider";

  if (query.postedWithinHours !== undefined) {
    const postedAt = job.postedAt ? Date.parse(job.postedAt) : Number.NaN;
    const oldestAllowed = now - query.postedWithinHours * 60 * 60 * 1_000;
    if (!Number.isFinite(postedAt)) return "date";
    if (postedAt < oldestAllowed || postedAt > now + 5 * 60 * 1_000) return "date";
  }

  if (query.minimumSalary !== undefined) {
    const highestKnownSalary = job.salaryMax ?? job.salaryMin;
    if (highestKnownSalary === undefined || highestKnownSalary < query.minimumSalary) return "salary";
  }

  return undefined;
}

export function jobMatchesQuery(job: NormalizedJob, query: JobSearchQuery, now = Date.now()): boolean {
  return jobFilterReason(job, query, now) === undefined;
}

function lexicalScore(job: NormalizedJob, query: JobSearchQuery): number {
  const terms = [...query.roles, ...query.keywords].flatMap((value) => normalized(value).split(" ")).filter(Boolean);
  if (!terms.length) return 0.5;
  const haystack = normalized(`${job.title} ${job.company} ${job.description ?? ""}`);
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

function recencyScore(job: NormalizedJob): number {
  if (!job.postedAt) return 0.35;
  const hours = Math.max(0, (Date.now() - Date.parse(job.postedAt)) / 3_600_000);
  if (!Number.isFinite(hours)) return 0.35;
  if (hours <= 24) return 1;
  if (hours <= 72) return 0.85;
  if (hours <= 168) return 0.7;
  if (hours <= 336) return 0.5;
  if (hours <= 720) return 0.3;
  return 0.1;
}

function sourceQuality(job: NormalizedJob): number {
  switch (job.sourceType) {
    case "official-api": return 1;
    case "public-ats": return 0.9;
    case "career-page": return 0.8;
    case "approved-feed": return 0.75;
    case "search-discovery": return 0.6;
    default: return 0.4;
  }
}

export function providerPriority(job: Pick<NormalizedJob, "provider">): number {
  return PRIORITY_JOB_SOURCES.get(job.provider.toLowerCase()) ?? 0.35;
}

export function rankWithoutProfile(jobs: NormalizedJob[], query: JobSearchQuery): NormalizedJob[] {
  return [...jobs].sort((a, b) => {
    const score = (job: NormalizedJob) =>
      0.45 * lexicalScore(job, query)
      + 0.25 * recencyScore(job)
      + 0.25 * providerPriority(job)
      + 0.05 * sourceQuality(job);
    return score(b) - score(a);
  });
}

function hasVerifiablePostedAt(job: NormalizedJob): boolean {
  return Boolean(job.postedAt && Number.isFinite(Date.parse(job.postedAt)));
}

function hasKnownCompany(job: NormalizedJob): boolean {
  return !/^(?:company not supplied|unknown company)$/i.test(job.company);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let next = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

async function enrichDiscoveryJob(job: NormalizedJob): Promise<NormalizedJob> {
  const url = job.sourceUrl ?? job.applicationUrl;
  if (!url) return job;

  const page = await fetchPublicJobPageMetadata(url);
  if (page.dead) return job;
  const parsedPostedAt = page.datePosted ? Date.parse(page.datePosted) : Number.NaN;
  const location = richerLocation(job.location, page.location);

  return {
    ...job,
    title: page.title ?? job.title,
    company: !hasKnownCompany(job) && page.company ? page.company : job.company,
    location,
    country: job.country ?? page.country ?? inferredCountryFromLocation(location),
    description: page.description ?? job.description,
    employmentType: job.employmentType ?? page.employmentType,
    seniority: job.seniority ?? page.seniority,
    postedAt: Number.isFinite(parsedPostedAt) ? new Date(parsedPostedAt).toISOString() : job.postedAt,
  };
}

async function enrichRelevantUndatedDiscoveryJobs(
  jobs: NormalizedJob[],
  query: JobSearchQuery,
  now: number,
): Promise<NormalizedJob[]> {
  if (query.postedWithinHours === undefined || !jobs.length) return jobs;

  // Search snippets are often incomplete. Do not reject a plausible discovery
  // row for missing location/country/structured metadata before opening the job page.
  const preMetadataQuery: JobSearchQuery = {
    ...query,
    keywords: [],
    locations: [],
    countries: [],
    workplaceTypes: [],
    employmentTypes: [],
    experienceLevels: [],
    postedWithinHours: undefined,
    minimumSalary: undefined,
  };
  const indexes = jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => job.sourceType === "search-discovery" && !hasVerifiablePostedAt(job) && jobMatchesQuery(job, preMetadataQuery, now))
    .slice(0, MAX_DISCOVERY_METADATA_ENRICHMENTS);

  if (!indexes.length) return jobs;

  const enriched = await mapWithConcurrency(indexes, DISCOVERY_METADATA_CONCURRENCY, async ({ job, index }) => ({
    index,
    job: await enrichDiscoveryJob(job),
  }));
  const copy = [...jobs];
  let recoveredDates = 0;

  for (const item of enriched) {
    copy[item.index] = item.job;
    if (hasVerifiablePostedAt(item.job)) recoveredDates += 1;
  }

  log("info", "job_discovery_metadata_enriched", {
    attempted: indexes.length,
    recoveredDates,
    stillUndated: indexes.length - recoveredDates,
  });

  return copy;
}

function breakdownBySource(jobs: NormalizedJob[]): Record<string, number> {
  return jobs.reduce<Record<string, number>>((counts, job) => {
    counts[job.provider] = (counts[job.provider] ?? 0) + 1;
    return counts;
  }, {});
}

export async function searchJobs(query: JobSearchQuery): Promise<AggregatedSearchResult> {
  const providers = configuredJobProviders(query);
  const settled = await Promise.allSettled(providers.map(async (provider): Promise<ProviderSearchResult> => {
    const started = Date.now();
    const timeoutMs = provider.id === "web-discovery" ? 20_000 : 10_000;
    const jobs = await withRetry((signal) => provider.search(query, signal), { attempts: 1, timeoutMs });
    return {
      providerId: provider.id,
      jobs,
      health: { providerId: provider.id, ok: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), jobsReturned: jobs.length },
    };
  }));

  const results: ProviderSearchResult[] = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    log("warn", "job_provider_failed", { provider: providers[index]?.id, error: result.reason instanceof Error ? result.reason.name : "UnknownError" });
    return { providerId: providers[index]?.id ?? "unknown", jobs: [], health: { providerId: providers[index]?.id ?? "unknown", ok: false, latencyMs: 0, checkedAt: new Date().toISOString(), errorCode: "PROVIDER_UNAVAILABLE" } };
  });

  const now = Date.now();
  const enrichedResults = await Promise.all(results.map(async (result) => {
    if (result.providerId !== "web-discovery") return result;
    const jobs = await enrichRelevantUndatedDiscoveryJobs(result.jobs, query, now);
    return { ...result, jobs };
  }));

  const filteredResults = enrichedResults.map((result) => {
    const rejectionCounts: Partial<Record<FilterReason, number>> = {};
    const jobs = result.jobs.filter((job) => {
      const reason = jobFilterReason(job, query, now);
      if (reason) rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
      return !reason;
    });

    if (result.providerId === "web-discovery") {
      log("info", "job_discovery_filter_diagnostics", {
        rawBySource: JSON.stringify(breakdownBySource(result.jobs)),
        keptBySource: JSON.stringify(breakdownBySource(jobs)),
        rejectedByReason: JSON.stringify(rejectionCounts),
      });
    }
    return { ...result, jobs, health: { ...result.health, jobsReturned: jobs.length } };
  });
  const deduplicated = deduplicateJobs(filteredResults.flatMap((result) => result.jobs)).map((job) => withFreshness(job));
  const ranked = rankWithoutProfile(deduplicated, query);
  const sourceBreakdown = breakdownBySource(ranked);
  const jobs = ranked.slice(0, query.limit);

  log("info", "job_search_completed", {
    requestedLimit: query.limit,
    totalMatches: ranked.length,
    returned: jobs.length,
    sourceBreakdown: JSON.stringify(sourceBreakdown),
    rawProviderRows: JSON.stringify(Object.fromEntries(results.map((result) => [result.providerId, result.jobs.length]))),
    providerRows: JSON.stringify(Object.fromEntries(filteredResults.map((result) => [result.providerId, result.jobs.length]))),
  });

  return {
    jobs,
    providers: filteredResults,
    partial: settled.some((result) => result.status === "rejected"),
    totalMatches: ranked.length,
    sourceBreakdown,
  };
}
