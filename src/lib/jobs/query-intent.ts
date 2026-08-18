import type { JobSearchQuery, WorkplaceType } from "@/src/types/jobs";

type SearchIntent = Partial<Omit<JobSearchQuery, "limit">>;

const ROLE_FAMILIES: Array<{ pattern: RegExp; roles: string[] }> = [
  { pattern: /\b(?:embedded|firmware|microcontroller|rtos|real[ -]?time system)\b/i, roles: ["Embedded Software Engineer", "Embedded Systems Engineer", "Firmware Engineer", "Embedded Developer", "Embedded C++ Engineer"] },
  { pattern: /\b(?:artificial intelligence|ai|ki|künstliche intelligenz|llm|large language model|nlp|natural language processing)\b/i, roles: ["AI Engineer", "Machine Learning Engineer", "NLP Engineer", "LLM Engineer", "Applied AI Engineer", "Generative AI Engineer", "AI Software Engineer", "ML Engineer"] },
  { pattern: /\bmachine learning\b|\bml engineer/i, roles: ["Machine Learning Engineer", "ML Engineer", "Applied Scientist"] },
  { pattern: /\bdata scien(?:ce|tist)\b/i, roles: ["Data Scientist", "Machine Learning Engineer", "Applied Scientist"] },
  { pattern: /\bdata engineer(?:ing)?\b/i, roles: ["Data Engineer", "Data Platform Engineer"] },
  { pattern: /\bcomputer vision\b/i, roles: ["Computer Vision Engineer", "Machine Learning Engineer"] },
  { pattern: /\bsoftware(?:entwickler| engineer| developer)?\b/i, roles: ["Software Engineer", "Software Developer", "Softwareentwickler"] },
  { pattern: /\bfront[ -]?end\b/i, roles: ["Frontend Engineer", "Frontend Developer", "UI Engineer"] },
  { pattern: /\bback[ -]?end\b/i, roles: ["Backend Engineer", "Backend Developer", "Server Engineer"] },
  { pattern: /\bfull[ -]?stack\b/i, roles: ["Full Stack Engineer", "Full Stack Developer", "Product Engineer"] },
  { pattern: /\bproduct engineer/i, roles: ["Product Engineer", "Full Stack Engineer", "Software Engineer"] },
  { pattern: /\bdevops\b|\bsite reliability\b|\bsre\b/i, roles: ["DevOps Engineer", "Site Reliability Engineer", "Platform Engineer"] },
  { pattern: /\bsecurity engineer|\bcyber ?security\b/i, roles: ["Security Engineer", "Cybersecurity Engineer", "Application Security Engineer"] },
];

const TECHNOLOGIES = [
  "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Java", "C++", "C#", ".NET", "Go", "Rust",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "PostgreSQL", "SQL", "GraphQL", "PyTorch", "TensorFlow", "LLM", "NLP",
  "Embedded C", "RTOS", "FreeRTOS", "STM32", "AUTOSAR", "ROS 2",
];

const COUNTRY_ALIASES: Array<[RegExp, string]> = [
  [/\bgermany\b|\bdeutschland\b/i, "Germany"],
  [/\begypt\b|\bمصر\b/i, "Egypt"],
  [/\bunited kingdom\b|\bgreat britain\b|\b(?:the )?uk\b|\bengland\b/i, "United Kingdom"],
  [/\bunited states\b|\busa\b|\bu\.s\.a?\.?\b/i, "United States"],
  [/\bfrance\b/i, "France"], [/\bnetherlands\b|\bholland\b/i, "Netherlands"],
  [/\bspain\b/i, "Spain"], [/\bportugal\b/i, "Portugal"], [/\baustria\b/i, "Austria"],
  [/\bswitzerland\b/i, "Switzerland"], [/\bcanada\b/i, "Canada"],
];

const REGION_ALIASES: Array<[RegExp, string]> = [
  [/\beurope(?:an union|an)?\b|\beu\b/i, "Europe"],
  [/\bemea\b/i, "EMEA"], [/\bworldwide\b|\bglobal(?:ly)?\b/i, "Worldwide"],
];

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function inferPostedWithinHours(text: string): number | undefined {
  const hours = text.match(/\b(?:last|past|within)\s+(\d{1,4})\s*(?:hours?|hrs?)\b/i);
  if (hours) return Number(hours[1]);
  const days = text.match(/\b(?:last|past|within)\s+(\d{1,3})\s*days?\b/i);
  if (days) return Number(days[1]) * 24;
  if (/\b(?:today|last|past)\s+(?:24\s*hours?|day)\b/i.test(text)) return 24;
  if (/\b(?:last|past)\s+3\s+days\b/i.test(text)) return 72;
  if (/\b(?:this|last|past)\s+week\b/i.test(text)) return 168;
  if (/\b(?:last|past)\s+14\s+days\b/i.test(text)) return 336;
  if (/\b(?:this|last|past)\s+month\b/i.test(text)) return 720;
  return undefined;
}

function inferExperienceLevels(text: string): string[] {
  const levels: string[] = [];
  if (/\b(?:intern|internship|praktikum)\b/i.test(text)) levels.push("Internship", "Intern");
  if (/\bworking[ -]?student\b|\bwerkstudent(?:in)?\b/i.test(text)) levels.push("Working student");
  if (/\b(?:entry[ -]?level|graduate|new grad)\b/i.test(text)) levels.push("Entry level", "Junior");
  if (/\bjunior\b/i.test(text)) levels.push("Junior", "Entry level");
  if (/\bmid[ -]?(?:level|senior)?\b/i.test(text)) levels.push("Mid level");
  if (/\bsenior\b/i.test(text)) levels.push("Senior");
  if (/\b(?:lead|principal|staff)\b/i.test(text)) levels.push("Lead", "Principal", "Staff");
  return unique(levels);
}

function inferEmploymentTypes(text: string): string[] {
  const types: string[] = [];
  if (/\bfull[ -]?time\b|\bvollzeit\b/i.test(text)) types.push("Full-time");
  if (/\bpart[ -]?time\b|\bteilzeit\b/i.test(text)) types.push("Part-time");
  if (/\bworking[ -]?student\b|\bwerkstudent(?:in)?\b/i.test(text)) types.push("Working Student");
  if (/\bcontract(?:or)?\b/i.test(text)) types.push("Contract");
  if (/\bfreelance\b/i.test(text)) types.push("Freelance");
  if (/\btemporary\b|\btemp\b/i.test(text)) types.push("Temporary");
  if (/\b(?:intern|internship|praktikum)\b/i.test(text)) types.push("Internship");
  return unique(types);
}

function inferWorkplaceTypes(text: string): WorkplaceType[] {
  const types: WorkplaceType[] = [];
  if (/\bremote\b|work from home|homeoffice/i.test(text)) types.push("remote");
  if (/\bhybrid\b/i.test(text)) types.push("hybrid");
  if (/\bon[ -]?site\b|in[ -]?office|vor ort/i.test(text)) types.push("onsite");
  return [...new Set(types)];
}

function inferLocations(text: string, countries: string[]): string[] {
  const regions = REGION_ALIASES.filter(([pattern]) => pattern.test(text)).map(([, region]) => region);
  const knownCities = ["Munich", "München", "Darmstadt", "Frankfurt", "Berlin", "Hamburg", "Stuttgart", "Ingolstadt", "Erlangen", "Nuremberg", "Nürnberg", "Cologne", "Köln", "Düsseldorf", "Cairo", "Giza", "New Cairo", "6th of October", "Alexandria", "Smart Village"];
  const city = knownCities.find((candidate) => new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const match = text.match(/\bin\s+([\p{L}][\p{L} .'-]{1,60}?)(?=\s+(?:posted|from|during|within|that|which|with|and\s+(?:remote|hybrid|on[ -]?site))\b|[,;.]|$)/iu);
  const location = city ?? match?.[1]?.trim();
  if (!location || /^the\s+(?:last|past)\b/i.test(location) || countries.some((country) => country.toLowerCase() === location.toLowerCase())) return unique(regions);
  return unique([...regions, location]);
}

function inferRolesAndKeywords(text: string, candidateRoles: string[]): Pick<SearchIntent, "roles" | "keywords"> {
  const roles = ROLE_FAMILIES.filter(({ pattern }) => pattern.test(text)).flatMap(({ roles: family }) => family);
  const keywords = TECHNOLOGIES.filter((technology) => {
    const escaped = technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  });

  if (!roles.length && /\bengineer(?:ing)?\b|\bdeveloper\b|\bentwickler\b/i.test(text)) {
    roles.push(/\bdeveloper|entwickler\b/i.test(text) ? "Developer" : "Engineer");
  }

  if (!roles.length) {
    const cleaned = text
      .replace(/^(?:find|show me|search(?: for)?|looking for|i want)\s+/i, "")
      .replace(/\b(?:jobs?|roles?|positions?|vacancies|stellen)\b/gi, " ")
      .replace(/\b(?:junior|senior|entry[ -]?level|graduate|new grad|remote|hybrid|on[ -]?site|full[ -]?time|part[ -]?time|working[ -]?student|werkstudent|praktikum|vollzeit|teilzeit)\b/gi, " ")
      .replace(/\b(?:posted|from|during|within|that|which|with)\b[\s\S]*$/i, " ")
      .replace(/\s+/g, " ").trim();
    if (cleaned && !/^(?:in\s+)?(?:germany|egypt|europe|worldwide|the uk|united kingdom)$/i.test(cleaned)) roles.push(cleaned);
  }

  if (!roles.length && /\b(?:fit|match)(?:s|es)?\s+my\s+(?:cv|profile|resume)\b/i.test(text)) roles.push(...candidateRoles);
  return { roles: unique(roles), keywords: unique(keywords) };
}

export function interpretSearchQuery(text: string, candidateRoles: string[] = []): SearchIntent {
  const countries = COUNTRY_ALIASES.filter(([pattern]) => pattern.test(text)).map(([, country]) => country);
  return {
    ...inferRolesAndKeywords(text, candidateRoles),
    countries: unique(countries),
    locations: inferLocations(text, countries),
    employmentTypes: inferEmploymentTypes(text),
    workplaceTypes: inferWorkplaceTypes(text),
    experienceLevels: inferExperienceLevels(text),
    postedWithinHours: inferPostedWithinHours(text),
  };
}

export function shouldUseAIQueryExpansion(text: string, deterministic: SearchIntent): boolean {
  const roles = deterministic.roles ?? [];
  if (!roles.length) return true;
  // Short, well-understood searches do not need a remote LLM round-trip.
  // Longer free-form requests can still benefit from structured AI expansion.
  return text.trim().length > 120;
}

export function mergeSearchIntent(
  deterministic: SearchIntent,
  ai: SearchIntent,
  filters: SearchIntent & Partial<Pick<JobSearchQuery, "limit" | "cursor">>,
): JobSearchQuery {
  const choose = <T>(explicit: T[] | undefined, ...fallbacks: Array<T[] | undefined>): T[] => {
    if (explicit?.length) return [...new Set(explicit)];
    return [...new Set(fallbacks.flatMap((values) => values ?? []))];
  };
  return {
    keywords: choose(filters.keywords, deterministic.keywords, ai.keywords),
    roles: choose(filters.roles, deterministic.roles, ai.roles),
    locations: choose(filters.locations, deterministic.locations, ai.locations),
    countries: choose(filters.countries, deterministic.countries, ai.countries),
    employmentTypes: choose(filters.employmentTypes, deterministic.employmentTypes, ai.employmentTypes),
    workplaceTypes: choose(filters.workplaceTypes, deterministic.workplaceTypes, ai.workplaceTypes),
    experienceLevels: choose(filters.experienceLevels, deterministic.experienceLevels, ai.experienceLevels),
    companies: choose(filters.companies, deterministic.companies, ai.companies),
    excludedCompanies: choose(filters.excludedCompanies, deterministic.excludedCompanies, ai.excludedCompanies),
    providers: choose(filters.providers, deterministic.providers, ai.providers),
    postedWithinHours: filters.postedWithinHours ?? deterministic.postedWithinHours ?? ai.postedWithinHours,
    minimumSalary: filters.minimumSalary,
    minimumMatchScore: filters.minimumMatchScore,
    limit: filters.limit ?? 25,
    cursor: filters.cursor,
  };
}
