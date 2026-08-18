import { describe, expect, it } from "vitest";
import { interpretSearchQuery, mergeSearchIntent, shouldUseAIQueryExpansion } from "@/src/lib/jobs/query-intent";

describe("natural-language job search interpretation", () => {
  it("extracts the smart-search example from the product specification", () => {
    const intent = interpretSearchQuery("Find junior AI, LLM and NLP jobs in Germany posted during the last 24 hours that fit my CV");
    expect(intent.roles).toEqual(expect.arrayContaining(["AI Engineer", "Machine Learning Engineer", "NLP Engineer", "LLM Engineer"]));
    expect(intent.countries).toEqual(["Germany"]);
    expect(intent.experienceLevels).toEqual(expect.arrayContaining(["Junior", "Entry level"]));
    expect(intent.postedWithinHours).toBe(24);
  });

  it("keeps role and technology intent without requiring an AI provider", () => {
    const intent = interpretSearchQuery("TypeScript engineer remote Europe");
    expect(intent.roles).toEqual(["Engineer"]);
    expect(intent.keywords).toEqual(["TypeScript"]);
    expect(intent.workplaceTypes).toEqual(["remote"]);
    expect(intent.locations).toEqual(["Europe"]);
  });

  it("expands embedded searches deterministically into relevant role families", () => {
    const intent = interpretSearchQuery("Embedded in Germany last 3 days");
    expect(intent.roles).toEqual(expect.arrayContaining(["Embedded Software Engineer", "Embedded Systems Engineer", "Firmware Engineer", "Embedded Developer"]));
    expect(intent.countries).toEqual(["Germany"]);
    expect(intent.postedWithinHours).toBe(72);
    expect(shouldUseAIQueryExpansion("Embedded in Germany last 3 days", intent)).toBe(false);
  });

  it("still permits AI expansion for long free-form requests", () => {
    const request = "I want a broad role that combines embedded systems, validation, hardware software integration, sensors, automotive work, and engineering responsibilities across several adjacent job titles in Germany";
    expect(shouldUseAIQueryExpansion(request, interpretSearchQuery(request))).toBe(true);
  });

  it("does not let empty UI arrays erase interpreted filters", () => {
    const merged = mergeSearchIntent(
      interpretSearchQuery("junior AI jobs in Germany remote this week"),
      {},
      { locations: [], workplaceTypes: [], limit: 50 },
    );
    expect(merged.countries).toEqual(["Germany"]);
    expect(merged.workplaceTypes).toEqual(["remote"]);
    expect(merged.postedWithinHours).toBe(168);
    expect(merged.limit).toBe(50);
  });

  it("lets a selected structured filter override the matching inferred field", () => {
    const merged = mergeSearchIntent(interpretSearchQuery("remote frontend jobs"), {}, { workplaceTypes: ["hybrid"] });
    expect(merged.workplaceTypes).toEqual(["hybrid"]);
  });
});
