type DiscoveryMetadataInput = {
  provider: string;
  title: string;
  company?: string;
  location?: string;
  description?: string;
  sourceUrl?: string;
  postedAt?: string;
  now?: number;
};

export type DiscoveryMetadata = {
  company?: string;
  location?: string;
  country?: string;
  postedAt?: string;
};

function decode(value: string | undefined): string {
  return (value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string): string {
  return decode(value).replace(/\s*[|–-]\s*(LinkedIn|Indeed(?:\.com)?|Glassdoor|XING(?: Jobs)?|StepStone)\s*$/i, "").trim();
}

function isUnknownCompany(value: string | undefined): boolean {
  return !value || /^(?:company not supplied|unknown company|unknown)$/i.test(value.trim());
}

function cleanCompany(value: string | undefined): string | undefined {
  const company = decode(value)
    .replace(/\s*\(gehört zu [^)]+\)\s*$/i, "")
    .replace(/^[\s.,;:·•|-]+|[\s.,;:·•|-]+$/g, "")
    .trim();
  if (!company || company.length > 100) return undefined;
  if (/^(?:join|apply|review|find|browse|search|full job|job details|stellenbeschreibung|software engineer|developer|engineer|we\b|who\b)/i.test(company)) return undefined;
  return company;
}

function cleanLocation(value: string | undefined): string | undefined {
  const location = decode(value)
    .replace(/^[\s.,;:·•|-]+|[\s.,;:·•|-]+$/g, "")
    .replace(/\s+(?:\d+\s+(?:hours?|days?|weeks?)\s+ago|vor\s+\d+\s+(?:stunden?|tagen?|wochen?)).*$/i, "")
    .trim();
  if (!location || location.length > 100) return undefined;
  if (/^(?:stellenbeschreibung|job details|full job description|apply|bewerben|easy apply)$/i.test(location)) return undefined;
  return location;
}

function looksLikeLocation(value: string | undefined): boolean {
  const location = cleanLocation(value);
  if (!location) return false;
  if (/\b(?:software|engineer|developer|development|manager|intern|student|support|platform|backend|frontend|fullstack|senior|junior|staff|lead)\b/i.test(location)) return false;
  return location.split(/\s+/).length <= 8 || /\b(?:germany|deutschland|remote|homeoffice)\b/i.test(location);
}

function titleCaseSlug(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.length <= 3 && /^[a-z]+$/i.test(part) ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function linkedinCompanyFromUrl(sourceUrl: string | undefined): string | undefined {
  if (!sourceUrl) return undefined;
  try {
    const path = decodeURIComponent(new URL(sourceUrl).pathname).replace(/\/+$/, "");
    const slug = path.split("/jobs/view/")[1];
    if (!slug || /^\d+$/.test(slug)) return undefined;
    const match = slug.match(/-at-(.+?)-\d{6,}$/i);
    return cleanCompany(match ? titleCaseSlug(match[1]) : undefined);
  } catch {
    return undefined;
  }
}

function linkedinMetadata(title: string, description: string, sourceUrl?: string): Pick<DiscoveryMetadata, "company" | "location"> {
  const raw = cleanTitle(title);

  const hiring = raw.match(/^(.+?)\s+(?:hiring|sucht)\s+(.+?)\s+in\s+(.+)$/i);
  if (hiring) return { company: cleanCompany(hiring[1]), location: cleanLocation(hiring[3]) };

  const germanAtEnd = raw.match(/^(.+?)\s+-\s+(.+?)\s+bei\s+(.+)$/i);
  if (germanAtEnd && looksLikeLocation(germanAtEnd[2])) {
    return { company: cleanCompany(germanAtEnd[3]), location: cleanLocation(germanAtEnd[2]) };
  }

  const atCompany = raw.match(/^(.+?)\s+(?:at|bei)\s+(.+?)(?:\s+[—-]\s+(.+))?$/i);
  if (atCompany) {
    return {
      company: cleanCompany(atCompany[2]),
      location: looksLikeLocation(atCompany[3]) ? cleanLocation(atCompany[3]) : undefined,
    };
  }

  const germanSnippet = description.match(/Bewerben Sie sich für die Stelle als .+? bei (.+?) in (.+?)(?:\.| Position\b)/i);
  if (germanSnippet) return { company: cleanCompany(germanSnippet[1]), location: cleanLocation(germanSnippet[2]) };

  const englishSnippet = description.match(/(?:apply for|join).*?(?: at| with) (.+?) in (.+?)(?:\.|,\s*(?:full[- ]?time|part[- ]?time))/i);
  if (englishSnippet) return { company: cleanCompany(englishSnippet[1]), location: cleanLocation(englishSnippet[2]) };

  const notifiedLocation = description.match(/Get notified about new .+? jobs in (.+?)(?:\.| Sign in)/i);
  return {
    company: linkedinCompanyFromUrl(sourceUrl),
    location: cleanLocation(notifiedLocation?.[1]),
  };
}

function removeLeadingTitle(description: string, title: string): string {
  const clean = cleanTitle(title);
  if (!clean) return description;
  const normalizedDescription = description.toLowerCase();
  const normalizedTitle = clean.toLowerCase();
  if (normalizedDescription.startsWith(normalizedTitle)) {
    return description.slice(clean.length).replace(/^[\s.:;|·•-]+/, "").trim();
  }
  return description;
}

function indeedMetadata(title: string, description: string): Pick<DiscoveryMetadata, "company" | "location"> {
  const raw = cleanTitle(title);
  let location: string | undefined;
  const suffix = raw.match(/\s+-\s+([^|]+)$/);
  if (suffix && looksLikeLocation(suffix[1])) location = cleanLocation(suffix[1]);

  const parentheticalCountry = raw.match(/\((Germany|Deutschland)\)\s*$/i);
  if (!location && parentheticalCountry) location = cleanLocation(parentheticalCountry[1]);

  const rest = removeLeadingTitle(description, raw);
  let company: string | undefined;
  let companyEnd = 0;

  const belongsTo = rest.match(/^(.+?\(gehört zu [^)]+\))\.\s*/i);
  if (belongsTo) {
    company = cleanCompany(belongsTo[1]);
    companyEnd = belongsTo[0].length;
  } else {
    const firstSentence = rest.match(/^(.+?)\.\s+(?=(?:[·•]|\d(?:\.\d)?\s*[·•.]|[A-ZÄÖÜ]))/);
    if (firstSentence) {
      company = cleanCompany(firstSentence[1]);
      companyEnd = firstSentence[0].length;
    }
  }

  const reviewCompany = description.match(/\b(?:review|salary|salaries)\s+for\s+.+?\s+at\s+(.+?)(?:,|\.|\s+in\s+)/i);
  if (!company && reviewCompany) company = cleanCompany(reviewCompany[1]);

  if (!location && companyEnd > 0) {
    let tail = rest.slice(companyEnd).replace(/^[\s.·•|-]+/, "");
    tail = tail.replace(/^\d(?:\.\d)?\s*[\s.·•|-]+/, "");
    const candidate = tail.match(/^([^.!?·•]{2,100})(?=[.!?·•]|$)/)?.[1];
    if (looksLikeLocation(candidate)) location = cleanLocation(candidate);
  }

  if (!location) {
    const labelled = description.match(/(?:^|[.·•]\s+)([A-ZÄÖÜ][^.!?·•]{1,80})(?:\.\s+Stellenbeschreibung|[·•]\s*(?:Homeoffice|Job details|Full job description))/i);
    if (looksLikeLocation(labelled?.[1])) location = cleanLocation(labelled?.[1]);
  }

  return { company, location };
}

function glassdoorMetadata(title: string, description: string): Pick<DiscoveryMetadata, "company" | "location"> {
  const raw = cleanTitle(title);
  const companyTitle = raw.match(/^(.+?)\s+(?:hiring|bietet Job als)\s+(.+?)\s+(?:Job )?in\s+(.+)$/i);
  if (companyTitle) return { company: cleanCompany(companyTitle[1]), location: cleanLocation(companyTitle[3]) };

  const locationFromTitle = raw.match(/\s+-\s+([^|]+)$/)?.[1];
  const locationFromDescription = description.match(/^.+?\.\s+([A-ZÄÖÜ][^.!?]{1,80})\.\s+(?:€|\$|£|Apply|Auf Website)/i)?.[1];
  return {
    location: looksLikeLocation(locationFromTitle) ? cleanLocation(locationFromTitle) : (looksLikeLocation(locationFromDescription) ? cleanLocation(locationFromDescription) : undefined),
  };
}

function amountFromWord(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

function relativeDate(text: string, now: number): string | undefined {
  const english = text.match(/\b(\d{1,3})\+?\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s+ago\b/i);
  if (english) {
    const amount = Number(english[1]);
    const unit = english[2].toLowerCase();
    const hours = unit.startsWith("month") ? amount * 30 * 24
      : unit.startsWith("week") ? amount * 7 * 24
        : unit.startsWith("day") ? amount * 24
          : unit.startsWith("hour") || unit.startsWith("hr") ? amount
            : amount / 60;
    return new Date(now - hours * 3_600_000).toISOString();
  }

  const german = text.match(/\bvor\s+(?:(\d{1,3})|einer|einem|einen)\s*(minute(?:n)?|stunde(?:n)?|tag(?:en)?|woche(?:n)?|monat(?:en)?)\b/i);
  if (german) {
    const amount = amountFromWord(german[1]);
    const unit = german[2].toLowerCase();
    const hours = unit.startsWith("monat") ? amount * 30 * 24
      : unit.startsWith("woche") ? amount * 7 * 24
        : unit.startsWith("tag") ? amount * 24
          : unit.startsWith("stunde") ? amount
            : amount / 60;
    return new Date(now - hours * 3_600_000).toISOString();
  }

  if (/\b(?:today|heute)\b/i.test(text)) return new Date(now).toISOString();
  if (/\b(?:yesterday|gestern)\b/i.test(text)) return new Date(now - 24 * 3_600_000).toISOString();
  return undefined;
}

function absoluteDate(text: string): string | undefined {
  const english = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i)?.[0];
  if (english) {
    const parsed = Date.parse(english);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  const germanNumeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (germanNumeric) {
    const [, day, month, year] = germanNumeric;
    const parsed = Date.UTC(Number(year), Number(month) - 1, Number(day));
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}

export function inferDiscoveryPostedAt(publishedDate: string | undefined, description: string | undefined, now = Date.now()): string | undefined {
  const published = decode(publishedDate);
  if (published) {
    const direct = Date.parse(published);
    if (Number.isFinite(direct)) return new Date(direct).toISOString();
  }

  const text = [published, decode(description)].filter(Boolean).join(" ");
  return relativeDate(text, now) ?? absoluteDate(text);
}

export function inferDiscoveryMetadata(input: DiscoveryMetadataInput): DiscoveryMetadata {
  const title = cleanTitle(input.title);
  const description = decode(input.description);
  const provider = input.provider.toLowerCase();

  let sourceFields: Pick<DiscoveryMetadata, "company" | "location"> = {};
  if (provider === "linkedin") sourceFields = linkedinMetadata(title, description, input.sourceUrl);
  else if (provider === "indeed") sourceFields = indeedMetadata(title, description);
  else if (provider === "glassdoor") sourceFields = glassdoorMetadata(title, description);

  const company = isUnknownCompany(input.company) ? sourceFields.company : cleanCompany(input.company);
  const location = cleanLocation(input.location) ?? sourceFields.location;
  const country = /\b(?:germany|deutschland)\b/i.test(location ?? "") ? "Germany" : undefined;

  return {
    company,
    location,
    country,
    postedAt: input.postedAt ?? inferDiscoveryPostedAt(undefined, description, input.now),
  };
}
