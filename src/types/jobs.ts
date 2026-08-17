export type WorkplaceType = "remote" | "hybrid" | "onsite" | "unknown";
export type JobFreshnessStatus =
  | "ACTIVE"
  | "LIKELY_ACTIVE"
  | "EXPIRED"
  | "REMOVED"
  | "UNKNOWN";

export type JobSourceType =
  | "official-api"
  | "public-ats"
  | "approved-feed"
  | "search-discovery"
  | "career-page"
  | "mock";

export interface NormalizedJob {
  id: string;
  externalId?: string;
  provider: string;
  sourceType?: JobSourceType;
  title: string;
  company: string;
  companyLogo?: string;
  location?: string;
  country?: string;
  city?: string;
  workplaceType: WorkplaceType;
  employmentType?: string;
  seniority?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryText?: string;
  description?: string;
  snippet?: string;
  skills: string[];
  postedAt?: string;
  firstDiscoveredAt: string;
  lastSeenAt: string;
  lastVerifiedAt?: string;
  applicationUrl?: string;
  sourceUrl: string;
  status: JobFreshnessStatus;
  freshnessLabel: "live" | "recently-refreshed" | "cached" | "unknown";
  sourceDelayHours?: number;
}

export interface JobSearchQuery {
  keywords: string[];
  roles: string[];
  locations: string[];
  countries: string[];
  employmentTypes: string[];
  workplaceTypes: WorkplaceType[];
  experienceLevels: string[];
  companies: string[];
  excludedCompanies: string[];
  providers: string[];
  postedWithinHours?: number;
  minimumSalary?: number;
  minimumMatchScore?: number;
  limit: number;
  cursor?: string;
}

export interface ProviderHealth {
  providerId: string;
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
  jobsReturned?: number;
  errorCode?: string;
  rateLimited?: boolean;
}

export interface JobProvider {
  id: string;
  name: string;
  sourceType: JobSourceType;
  search(query: JobSearchQuery, signal?: AbortSignal): Promise<NormalizedJob[]>;
  healthCheck?(signal?: AbortSignal): Promise<ProviderHealth>;
}

export type JobProviderAvailability =
  | "active"
  | "optional"
  | "discovery"
  | "ats-discovery"
  | "restricted";

export interface JobProviderCatalogEntry {
  id: string;
  name: string;
  availability: JobProviderAvailability;
  coverage: "global" | "remote" | "regional" | "company-specific";
  detail: string;
  setup?: string;
}

export interface ProviderSearchResult {
  providerId: string;
  jobs: NormalizedJob[];
  health: ProviderHealth;
}
