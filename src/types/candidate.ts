export interface CandidateSkill {
  name: string;
  years?: number;
  source: "cv" | "user";
}

export interface CandidateProfile {
  id?: string;
  userId?: string;
  fullName?: string;
  currentTitle?: string;
  location?: string;
  summary?: string;
  skills: CandidateSkill[];
  programmingLanguages: string[];
  frameworks: string[];
  tools: string[];
  certifications: string[];
  languages: Array<{ name: string; level?: string }>;
  yearsExperience?: number;
  preferredRoles: string[];
  preferredCountries: string[];
  preferredLocations: string[];
  employmentTypes: string[];
  workplaceTypes: string[];
  manualFields: string[];
}

