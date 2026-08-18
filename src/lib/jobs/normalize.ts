import { createHash } from "node:crypto";
import type { JobFreshnessStatus, JobSourceType, NormalizedJob, WorkplaceType } from "@/src/types/jobs";
import { inferDiscoveryMetadata } from "./discovery-metadata";
import { canonicalDiscoveryJobUrl } from "./discovery-url";

export function stableJobId(provider: string, externalId: string): string {
  return createHash("sha256").update(`${provider}:${externalId}`).digest("hex").slice(0, 32);
}

export function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value
    .replace(/<[^>]*>/g, " ")
    .replace(/#{2,}/g, " ")
    .replace(/[\u2022·]{2,}/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || undefined;
}

export function inferWorkplaceType(...values: Array<string | undefined>): WorkplaceType {
  for (const value of values) {
    const text = value?.toLowerCase() ?? "";
    if (/\bhybrid\b/.test(text)) return "hybrid";
    if (/\bremote\b|work from home|distributed|homeoffice/.test(text)) return "remote";
    if (/\bon[ -]?site\b|in office|vor ort/.test(text)) return "onsite";
  }
  return "unknown";
}

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

const GERMANY_LOCATION_HINTS = [
  "berlin", "munich", "münchen", "hamburg", "bremen", "hannover", "frankfurt", "stuttgart", "cologne", "köln",
  "düsseldorf", "dortmund", "essen", "leipzig", "dresden", "nuremberg", "nürnberg", "erlangen", "ingolstadt",
  "darmstadt", "ulm", "aachen", "karlsruhe", "regensburg", "potsdam", "mannheim", "heidelberg", "wolfsburg",
  "braunschweig", "saarbrücken", "jena", "bielefeld", "bochum", "bonn", "würzburg", "mainz", "wiesbaden",
  "freiburg", "rellingen", "hohenfels", "bavaria", "bayern", "hesse", "hessen", "saxony", "sachsen",
  "lower saxony", "niedersachsen", "north rhine westphalia", "nordrhein westfalen", "nrw", "baden württemberg",
  "thuringia", "thüringen", "schleswig holstein", "saxony anhalt", "sachsen anhalt", "brandenburg", "saarland",
  "mecklenburg vorpommern",
];

function inferCountryFromLocation(value: string | undefined): string | undefined {
  const location = cleanText(value);
  if (!location) return undefined;
  const lower = location.toLowerCase();

  if (/\b(?:germany|deutschland)\b/i.test(location) || GERMANY_LOCATION_HINTS.some((hint) => lower.includes(hint))) return "Germany";
  if (/\b(?:egypt|ägypten)\b/i.test(location)) return "Egypt";
  if (/\b(?:united states|u\.s\.|u\.s\.a\.|usa)\b/i.test(location)) return "United States";
  if (/\b(?:united kingdom|great britain|england|scotland|wales)\b/i.test(location)) return "United Kingdom";
  if (/\b(?:switzerland|schweiz|suisse|svizzera)\b/i.test(location)) return "Switzerland";
  if (/\b(?:austria|österreich)\b/i.test(location)) return "Austria";
  if (/\b(?:france|frankreich)\b/i.test(location)) return "France";
  if (/\b(?:netherlands|niederlande|holland)\b/i.test(location)) return "Netherlands";
  if (/\b(?:belgium|belgien)\b/i.test(location)) return "Belgium";
  if (/\b(?:poland|polen)\b/i.test(location)) return "Poland";
  if (/\b(?:czechia|czech republic|tschechien)\b/i.test(location)) return "Czechia";
  if (/\b(?:denmark|dänemark)\b/i.test(location)) return "Denmark";
  if (/\b(?:sweden|schweden)\b/i.test(location)) return "Sweden";
  if (/\b(?:norway|norwegen)\b/i.test(location)) return "Norway";
  if (/\b(?:finland|finnland)\b/i.test(location)) return "Finland";
  if (/\b(?:italy|italien)\b/i.test(location)) return "Italy";
  if (/\b(?:spain|spanien)\b/i.test(location)) return "Spain";
  if (/\bportugal\b/i.test(location)) return "Portugal";
  if (/\b(?:ireland|irland)\b/i.test(location)) return "Ireland";
  if (/\bcanada\b/i.test(location)) return "Canada";
  if (/\bindia\b/i.test(location)) return "India";

  const segments = location.split(",").map((segment) => segment.trim()).filter(Boolean);
  const last = segments.at(-1)?.toUpperCase();
  if (last === "US" || last === "USA") return "United States";
  if (last === "UK" || last === "GB") return "United Kingdom";
  if (last === "EG") return "Egypt";
  if (last && US_STATE_CODES.has(last)) return "United States";

  return undefined;
}

function containsKnownSkill(text: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
}

export function inferSkills(text: string | undefined): string[] {
  if (!text) return [];
  const known = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java",
    "C#", ".NET", "Go", "Rust", "C++", "Embedded C", "C", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
    "PostgreSQL", "SQL", "GraphQL", "REST", "Terraform", "Figma", "Git", "Linux",
    "Machine Learning", "AI", "LLM", "NLP", "PyTorch", "TensorFlow", "Computer Vision",
    "RTOS", "FreeRTOS", "Bare-Metal", "STM32", "ARM Cortex-M", "UART", "SPI", "I2C", "CAN", "CANoe",
    "AUTOSAR", "ROS 2", "Squish", "MATLAB", "Simulink", "Altium Designer", "Cadence Allegro", "PCB Design",
    "Sensor Validation", "Environmental Testing", "Data Acquisition", "Regression Testing", "Hardware Debugging",
    "Board Bring-Up", "CUDA", "ONNX Runtime", "YOLOv8", "RViz",
  ];
  return known.filter((skill) => containsKnownSkill(text, skill));
}

export function inferSeniority(...values: Array<string | undefined>): string | undefined {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(?:intern|internship|praktikum)\b/.test(text)) return "Internship";
  if (/\bworking[ -]?student\b|\bwerkstudent/.test(text)) return "Working student";
  if (/\b(?:entry[ -]?level|berufseinstieg|graduate|new grad|junior)\b/.test(text)) return "Junior";
  if (/\b(?:principal|staff)\b/.test(text)) return /\bprincipal\b/.test(text) ? "Principal" : "Staff";
  if (/\b(?:lead|head of)\b/.test(text)) return "Lead";
  if (/\bsenior\b|\bsr\.?\b/.test(text)) return "Senior";
  if (/\bmid[ -]?level\b|\bmid[ -]?senior\b|\bassociate\b|\bberufserfahren\b/.test(text)) return "Mid level";
  return undefined;
}

function inferLabelledDiscoverySeniority(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(/(?:seniority level|karrierestufe)\s*[:·-]?\s*([a-zäöüß -]{3,40})/i)?.[1];
  return inferSeniority(match);
}

function sourceTypeFor(provider: string): JobSourceType {
  if (provider === "mock") return "mock";
  if (["adzuna", "jooble"].includes(provider)) return "official-api";
  if (["arbeitnow", "remote-ok", "remotive"].includes(provider)) return "approved-feed";
  if (provider === "ats-registry") return "public-ats";
  return "career-page";
}

export function normalizedJob(input: {
  provider: string;
  sourceType?: JobSourceType;
  externalId: string;
  title: string;
  company: string;
  sourceUrl: string;
  applicationUrl?: string;
  location?: string;
  country?: string;
  city?: string;
  description?: string;
  snippet?: string;
  employmentType?: string;
  salaryText?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: string;
  companyLogo?: string;
  skills?: string[];
  seniority?: string;
  workplaceType?: WorkplaceType;
  sourceDelayHours?: number;
  status?: JobFreshnessStatus;
}): NormalizedJob {
  const now = new Date().toISOString();
  const description = cleanText(input.description);
  const sourceType = input.sourceType ?? sourceTypeFor(input.provider);

  const discoveryMetadata = sourceType === "search-discovery"
    ? inferDiscoveryMetadata({
      provider: input.provider,
      title: input.title,
      company: input.company,
      location: input.location,
      description,
      sourceUrl: input.sourceUrl,
      postedAt: input.postedAt,
    })
    : {};

  const stableLink = sourceType === "search-discovery" ? canonicalDiscoveryJobUrl(input.sourceUrl) : undefined;
  const sourceUrl = stableLink?.url ?? input.sourceUrl;
  const applicationUrl = sourceType === "search-discovery"
    ? (canonicalDiscoveryJobUrl(input.applicationUrl ?? input.sourceUrl)?.url ?? sourceUrl)
    : input.applicationUrl;
  const externalId = sourceType === "search-discovery" ? (stableLink?.sourceId ?? sourceUrl) : input.externalId;

  const location = cleanText(input.location) ?? cleanText(discoveryMetadata.location);
  const country = cleanText(input.country)
    ?? cleanText(discoveryMetadata.country)
    ?? inferCountryFromLocation(location)
    ?? (sourceType === "search-discovery" ? "Unknown" : undefined);
  const company = cleanText(discoveryMetadata.company) ?? cleanText(input.company) ?? "Unknown company";
  const postedAt = input.postedAt ?? discoveryMetadata.postedAt;
  const seniority = cleanText(input.seniority)
    ?? inferSeniority(input.title)
    ?? (sourceType === "search-discovery" ? inferLabelledDiscoverySeniority(description) : inferSeniority(description));

  return {
    id: stableJobId(input.provider, externalId),
    externalId,
    provider: input.provider,
    sourceType,
    title: cleanText(input.title) ?? "Untitled role",
    company,
    companyLogo: input.companyLogo,
    location,
    country,
    city: cleanText(input.city),
    workplaceType: input.workplaceType ?? inferWorkplaceType(location, description),
    employmentType: cleanText(input.employmentType),
    seniority,
    salaryText: cleanText(input.salaryText),
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    salaryCurrency: cleanText(input.salaryCurrency),
    description,
    snippet: cleanText(input.snippet) ?? description?.slice(0, 320),
    skills: [...new Set([...inferSkills(description), ...(input.skills ?? []).map((skill) => cleanText(skill)).filter((skill): skill is string => Boolean(skill))])],
    postedAt,
    firstDiscoveredAt: now,
    lastSeenAt: now,
    lastVerifiedAt: now,
    applicationUrl,
    sourceUrl,
    status: input.status ?? "LIKELY_ACTIVE",
    freshnessLabel: input.sourceDelayHours ? "cached" : "recently-refreshed",
    sourceDelayHours: input.sourceDelayHours,
  };
}
