import { z } from "zod";
import type { JobProvider, JobSearchQuery } from "@/src/types/jobs";
import { normalizedJob } from "../normalize";

const jobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  description: z.string().nullish(),
  redirect_url: z.string().url(),
  created: z.string().nullish(),
  location: z.object({ display_name: z.string().nullish() }).nullish(),
  company: z.object({ display_name: z.string().nullish() }).nullish(),
  category: z.object({ label: z.string().nullish() }).nullish(),
  contract_type: z.string().nullish(),
  contract_time: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
});
const responseSchema = z.object({ results: z.array(z.unknown()) });

const COUNTRY_CODES: Record<string, string> = {
  austria: "at", australia: "au", belgium: "be", brazil: "br", canada: "ca",
  switzerland: "ch", germany: "de", spain: "es", france: "fr", india: "in",
  italy: "it", mexico: "mx", netherlands: "nl", "new zealand": "nz", poland: "pl",
  singapore: "sg", "south africa": "za", "united kingdom": "gb", uk: "gb",
  "united states": "us", usa: "us",
};
const COUNTRY_NAMES: Record<string, string> = {
  at: "Austria", au: "Australia", be: "Belgium", br: "Brazil", ca: "Canada",
  ch: "Switzerland", de: "Germany", es: "Spain", fr: "France", gb: "United Kingdom",
  in: "India", it: "Italy", mx: "Mexico", nl: "Netherlands", nz: "New Zealand",
  pl: "Poland", sg: "Singapore", us: "United States", za: "South Africa",
};

function selectedCountries(query: JobSearchQuery, configured: string[]): string[] {
  const requested = query.countries.map((country) => COUNTRY_CODES[country.toLowerCase()]).filter(Boolean);
  return [...new Set(requested.length ? requested : configured)].slice(0, 4);
}

export function createAdzunaProvider(config: { appId: string; appKey: string; countries: string[] }): JobProvider {
  return {
    id: "adzuna",
    name: "Adzuna official jobs API",
    sourceType: "official-api",
    async search(query, signal) {
      const what = [...query.roles, ...query.keywords].slice(0, 5).join(" ");
      const where = query.locations[0];
      const countries = selectedCountries(query, config.countries);
      const responses = await Promise.all(countries.map(async (country) => {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
        url.searchParams.set("app_id", config.appId);
        url.searchParams.set("app_key", config.appKey);
        url.searchParams.set("results_per_page", String(Math.min(query.limit, 50)));
        url.searchParams.set("sort_by", "date");
        if (what) url.searchParams.set("what", what);
        if (where) url.searchParams.set("where", where);
        if (query.postedWithinHours) url.searchParams.set("max_days_old", String(Math.max(1, Math.ceil(query.postedWithinHours / 24))));
        if (query.minimumSalary) url.searchParams.set("salary_min", String(query.minimumSalary));
        const response = await fetch(url, { signal, headers: { Accept: "application/json" }, next: { revalidate: 1_800 } });
        if (!response.ok) throw new Error(`Adzuna returned ${response.status}`);
        const body = responseSchema.parse(await response.json());
        return body.results.flatMap((row) => {
          const parsed = jobSchema.safeParse(row);
          return parsed.success ? [{ ...parsed.data, country }] : [];
        });
      }));
      return responses.flat().map((job) => normalizedJob({
        provider: "adzuna",
        externalId: `${job.country}:${job.id}`,
        title: job.title,
        company: job.company?.display_name ?? "Employer not supplied",
        location: job.location?.display_name ?? undefined,
        country: COUNTRY_NAMES[job.country] ?? job.country.toUpperCase(),
        description: job.description ?? undefined,
        employmentType: job.contract_type ?? job.contract_time ?? undefined,
        skills: job.category?.label ? [job.category.label] : [],
        postedAt: job.created ?? undefined,
        salaryMin: job.salary_min ?? undefined,
        salaryMax: job.salary_max ?? undefined,
        sourceUrl: job.redirect_url,
        applicationUrl: job.redirect_url,
        sourceDelayHours: 1,
      }));
    },
  };
}
