type PageJobMetadata = {
  title?: string;
  company?: string;
  location?: string;
  country?: string;
  datePosted?: string;
  description?: string;
  employmentType?: string;
  seniority?: string;
  dead?: boolean;
};

type JsonObject = Record<string, unknown>;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = decodeHtml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean || undefined;
}

function objects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (!value || typeof value !== "object") return [];
  const object = value as JsonObject;
  return [object, ...Object.values(object).flatMap(objects)];
}

function isJobPosting(object: JsonObject): boolean {
  const type = object["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

function companyName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  return text((value as JsonObject).name);
}

function countryText(value: unknown): string | undefined {
  const direct = text(value);
  if (direct) return direct;
  if (!value || typeof value !== "object") return undefined;
  const object = value as JsonObject;
  return text(object.name) ?? text(object.addressCountry);
}

function addressObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as JsonObject;
  if (object.address && typeof object.address === "object") return object.address as JsonObject;
  return object;
}

function addressCountry(value: unknown): string | undefined {
  const address = addressObject(value);
  return countryText(address?.addressCountry);
}

function addressText(value: unknown): string | undefined {
  const address = addressObject(value);
  if (!address) return undefined;
  const country = countryText(address.addressCountry);
  return [address.addressLocality, address.addressRegion]
    .map(text)
    .concat(country ? [country] : [])
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(", ") || undefined;
}

function jobLocation(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const locations = value.map(addressText).filter((part): part is string => Boolean(part));
    return [...new Set(locations)].join(" / ") || undefined;
  }
  return addressText(value);
}

function jobCountry(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const countries = value.map(addressCountry).filter((part): part is string => Boolean(part));
    return [...new Set(countries)].join(" / ") || undefined;
  }
  return addressCountry(value);
}

function requirementCountry(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const countries = value.map(requirementCountry).filter((part): part is string => Boolean(part));
    return [...new Set(countries)].join(" / ") || undefined;
  }
  const direct = countryText(value);
  if (direct) return direct;
  if (!value || typeof value !== "object") return undefined;
  const object = value as JsonObject;
  return countryText(object.addressCountry) ?? countryText(object.name);
}

function normalizeEmploymentType(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value.map(text).filter(Boolean).join(" / ") : text(value);
  if (!raw) return undefined;
  if (/full[ _-]?time|vollzeit/i.test(raw)) return "Full-time";
  if (/part[ _-]?time|teilzeit/i.test(raw)) return "Part-time";
  if (/internship|praktikum|\bintern\b/i.test(raw)) return "Internship";
  if (/working[ _-]?student|werkstudent/i.test(raw)) return "Working Student";
  if (/contract|befristet/i.test(raw)) return "Contract";
  if (/temporary|temp/i.test(raw)) return "Temporary";
  return raw.slice(0, 80);
}

function normalizeSeniority(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/entry[ -]?level|berufseinstieg|graduate|new grad|junior/i.test(value)) return "Junior";
  if (/mid[ -]?senior|mid[ -]?level|associate|berufserfahren/i.test(value)) return "Mid level";
  if (/senior/i.test(value)) return "Senior";
  if (/staff/i.test(value)) return "Staff";
  if (/principal/i.test(value)) return "Principal";
  if (/lead|director|head of/i.test(value)) return "Lead";
  if (/internship|praktikum|\bintern\b/i.test(value)) return "Internship";
  return value.trim().slice(0, 80) || undefined;
}

function parseJsonLd(html: string): PageJobMetadata | undefined {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const posting = objects(parsed).find(isJobPosting);
      if (!posting) continue;
      return {
        title: text(posting.title),
        company: companyName(posting.hiringOrganization),
        location: jobLocation(posting.jobLocation),
        country: jobCountry(posting.jobLocation) ?? requirementCountry(posting.applicantLocationRequirements),
        datePosted: text(posting.datePosted),
        description: text(posting.description),
        employmentType: normalizeEmploymentType(posting.employmentType),
      };
    } catch {
      // Ignore malformed third-party JSON-LD and continue to the next script.
    }
  }
  return undefined;
}

function attribute(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, "i"));
  return text(match?.[1]);
}

function canonicalMeta(html: string, property: string): string | undefined {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = attribute(tag, "property") ?? attribute(tag, "name");
    if (key?.toLowerCase() !== property.toLowerCase()) continue;
    return attribute(tag, "content");
  }
  return undefined;
}

function relativeDate(value: string, now = Date.now()): string | undefined {
  const english = value.match(/\b(\d{1,3})\+?\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s+ago\b/i);
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

  const german = value.match(/\bvor\s+(?:(\d{1,3})|einer|einem|einen)\s*(minute(?:n)?|stunde(?:n)?|tag(?:en)?|woche(?:n)?|monat(?:en)?)\b/i);
  if (german) {
    const amount = german[1] ? Number(german[1]) : 1;
    const unit = german[2].toLowerCase();
    const hours = unit.startsWith("monat") ? amount * 30 * 24
      : unit.startsWith("woche") ? amount * 7 * 24
        : unit.startsWith("tag") ? amount * 24
          : unit.startsWith("stunde") ? amount
            : amount / 60;
    return new Date(now - hours * 3_600_000).toISOString();
  }

  if (/\b(?:today|heute)\b/i.test(value)) return new Date(now).toISOString();
  if (/\b(?:yesterday|gestern)\b/i.test(value)) return new Date(now - 24 * 3_600_000).toISOString();
  return undefined;
}

function embeddedDate(html: string): string | undefined {
  for (const match of html.matchAll(/<time\b[^>]*>/gi)) {
    const datetime = attribute(match[0], "datetime");
    if (datetime && Number.isFinite(Date.parse(datetime))) return new Date(datetime).toISOString();
  }

  const keyed = html.match(/(?:"|&quot;)(?:datePosted|postedDate|publishedAt)(?:"|&quot;)\s*:\s*(?:"|&quot;)([^"&<]+)(?:"|&quot;)/i)?.[1];
  if (keyed && Number.isFinite(Date.parse(decodeHtml(keyed)))) return new Date(decodeHtml(keyed)).toISOString();

  const listedAt = html.match(/(?:"|&quot;)listedAt(?:"|&quot;)\s*:\s*(?:"|&quot;)?(\d{10,13})/i)?.[1];
  if (listedAt) {
    const value = Number(listedAt);
    const timestamp = listedAt.length <= 10 ? value * 1_000 : value;
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }

  return canonicalMeta(html, "article:published_time") ?? canonicalMeta(html, "date");
}

function visibleText(html: string): string {
  return text(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")) ?? "";
}

function visibleDate(html: string): string | undefined {
  const visible = visibleText(html).slice(0, 180_000);
  const relative = relativeDate(visible);
  if (relative) return relative;

  const numeric = visible.match(/(?:publi[ée]\s+le|posted\s+on|veröffentlicht(?:\s+am)?)\s+(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i);
  if (numeric) return new Date(Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]))).toISOString();

  const english = visible.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i)?.[0];
  if (english && Number.isFinite(Date.parse(english))) return new Date(english).toISOString();
  return undefined;
}

function visibleEmploymentType(html: string): string | undefined {
  const visible = visibleText(html).slice(0, 180_000);
  const labelled = visible.match(/(?:Employment type|Beschäftigungsverhältnis|Anstellungsart)\s*[:·-]?\s*([A-Za-zÄÖÜäöüß -]{3,40})/i)?.[1];
  return normalizeEmploymentType(labelled);
}

function visibleSeniority(html: string): string | undefined {
  const visible = visibleText(html).slice(0, 180_000);
  const labelled = visible.match(/(?:Seniority level|Karrierestufe)\s*[:·-]?\s*([A-Za-zÄÖÜäöüß -]{3,40})/i)?.[1];
  return normalizeSeniority(labelled);
}

export async function fetchPublicJobPageMetadata(url: string, signal?: AbortSignal): Promise<PageJobMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; JobHuntingMetadata/1.0; +public-job-metadata)",
      },
    });

    if (response.status === 404 || response.status === 410) return { dead: true };
    if (!response.ok) return {};
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return {};

    const html = (await response.text()).slice(0, 1_500_000);
    const structured = parseJsonLd(html) ?? {};

    return {
      ...structured,
      title: structured.title ?? canonicalMeta(html, "og:title"),
      description: structured.description ?? canonicalMeta(html, "og:description") ?? canonicalMeta(html, "description"),
      datePosted: structured.datePosted ?? embeddedDate(html) ?? visibleDate(html),
      employmentType: structured.employmentType ?? visibleEmploymentType(html),
      seniority: structured.seniority ?? visibleSeniority(html),
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
