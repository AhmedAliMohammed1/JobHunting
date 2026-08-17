export type CareerProvider = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "personio" | "workday" | "successfactors";

export interface CompanyCareerSource {
  company: string;
  provider: CareerProvider;
  identifier: string;
  careerUrl?: string;
}

export function parseCareerSources(value: string): CompanyCareerSource[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const candidate = row as Record<string, unknown>;
      const provider = candidate.provider;
      if (typeof candidate.company !== "string" || typeof candidate.identifier !== "string") return [];
      if (!["greenhouse", "lever", "ashby", "smartrecruiters", "personio", "workday", "successfactors"].includes(String(provider))) return [];
      return [{
        company: candidate.company.trim(),
        provider: provider as CareerProvider,
        identifier: candidate.identifier.trim(),
        careerUrl: typeof candidate.careerUrl === "string" ? candidate.careerUrl.trim() : undefined,
      }];
    }).filter((source) => source.company && source.identifier);
  } catch {
    return [];
  }
}

export function careerSourceHost(source: CompanyCareerSource): string | undefined {
  if (source.careerUrl) {
    try { return new URL(source.careerUrl).hostname; } catch { return undefined; }
  }
  switch (source.provider) {
    case "greenhouse": return "boards.greenhouse.io";
    case "lever": return "jobs.lever.co";
    case "ashby": return "jobs.ashbyhq.com";
    case "smartrecruiters": return "jobs.smartrecruiters.com";
    case "personio": return source.identifier.includes(".") ? source.identifier : `${source.identifier}.jobs.personio.de`;
    case "workday":
    case "successfactors": return source.identifier.includes(".") ? source.identifier : undefined;
  }
}
