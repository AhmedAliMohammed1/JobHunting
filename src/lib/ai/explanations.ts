export interface MatchExplanation {
  strongMatches: string[];
  potentialGaps: string[];
  overall: string;
}

export function createDeterministicExplanation(matched: string[], missing: string[]): MatchExplanation {
  const strongMatches = matched.slice(0, 6);
  const potentialGaps = missing.slice(0, 4);
  const overall = strongMatches.length
    ? `Your verified ${strongMatches.join(", ")} experience aligns with this role.${potentialGaps.length ? ` The clearest gaps are ${potentialGaps.join(", ")}.` : " No major explicit skill gaps were detected."}`
    : "The role has limited overlap with the verified skills in your current profile.";
  return { strongMatches, potentialGaps, overall };
}

