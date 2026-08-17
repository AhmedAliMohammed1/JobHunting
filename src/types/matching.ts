export interface MatchBreakdown {
  semantic: number;
  skills: number;
  title: number;
  experience: number;
  location: number;
  employment: number;
  workplace: number;
  recency: number;
}

export interface MatchResult {
  score: number;
  band: string;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}
