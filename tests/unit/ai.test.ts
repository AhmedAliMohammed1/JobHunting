import { describe, expect, it } from "vitest";
import { mapApprovedAnswers, mayGenerateFreeText } from "@/src/lib/ai/answer-engine";
import { mergeAuthoritativeProfile, parseCandidateText } from "@/src/lib/ai/candidate-parser";
import { generateCoverLetter } from "@/src/lib/ai/cover-letter";
import { cosineSimilarity, embedMinimalProfile, embeddingContentHash } from "@/src/lib/ai/embeddings";
import { createDeterministicExplanation } from "@/src/lib/ai/explanations";
import { parseJobRequirements } from "@/src/lib/ai/job-parser";
import type { AIProvider } from "@/src/lib/ai/provider";

class FixtureProvider implements AIProvider {
  readonly id = "fixture";
  constructor(private readonly fixture: unknown) {}
  async generateStructured<T>() { return this.fixture as T; }
  async embed() { return [1, 0, 1]; }
}

describe("AI boundary and truthfulness helpers", () => {
  it("parses bounded candidate facts and preserves manual edits", async () => {
    const fixture = { fullName: "Sam", currentTitle: "Engineer", location: "Cairo", skills: ["TypeScript"], programmingLanguages: ["TypeScript"], frameworks: ["Next.js"], tools: ["Git"], education: [], employment: [], projects: [], certifications: [], languages: [{ name: "English", level: "C1" }], yearsExperience: 4 };
    expect((await parseCandidateText(new FixtureProvider(fixture), "CV text")).fullName).toBe("Sam");
    expect(mergeAuthoritativeProfile({ fullName: "Manual", location: "Old" }, { fullName: "Parsed", location: "New" }, ["fullName"])).toEqual({ fullName: "Manual", location: "New" });
    await expect(parseCandidateText(new FixtureProvider(fixture), "x".repeat(120_001))).rejects.toThrow(/safe parsing limit/i);
  });

  it("parses explicit job requirements", async () => {
    const result = await parseJobRequirements(new FixtureProvider({ requiredSkills: ["TypeScript"], preferredSkills: [], minimumYearsExperience: 3, languages: ["English"], seniority: "Mid" }), "Role");
    expect(result.minimumYearsExperience).toBe(3);
  });

  it("only allows cover letters that cite approved candidate facts", async () => {
    const letter = "A".repeat(120);
    await expect(generateCoverLetter(new FixtureProvider({ coverLetter: letter, usedFacts: ["Built APIs"] }), ["Built APIs"], ["Needs APIs"])).resolves.toBe(letter);
    await expect(generateCoverLetter(new FixtureProvider({ coverLetter: letter, usedFacts: ["Invented award"] }), ["Built APIs"], ["Needs APIs"])).rejects.toThrow(/unapproved fact/i);
  });

  it("maps only approved answers and blocks generated sensitive answers", () => {
    const mapped = mapApprovedAnswers([{ id: "1", label: "Email", type: "email", required: true }, { id: "2", label: "Visa sponsorship", type: "text", required: true }], [{ question: "Email", answer: "sam@example.com", source: "user-profile" }]);
    expect(mapped[0]).toMatchObject({ value: "sam@example.com", unknown: false, confidence: 1 });
    expect(mapped[1]).toMatchObject({ sensitive: true, unknown: true, confidence: 0 });
    expect(mayGenerateFreeText(mapped[0])).toBe(false);
    expect(mayGenerateFreeText({ id: "3", label: "Why this role?", type: "textarea", required: true })).toBe(true);
  });

  it("hashes normalized content, embeds it, and calculates cosine similarity", async () => {
    expect(embeddingContentHash("hello   world")).toBe(embeddingContentHash(" hello world "));
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect((await embedMinimalProfile(new FixtureProvider(null), "profile")).vector).toEqual([1, 0, 1]);
  });

  it("creates bounded deterministic explanations", () => {
    expect(createDeterministicExplanation(["TypeScript"], ["Go"]).overall).toMatch(/clearest gaps/i);
    expect(createDeterministicExplanation([], []).overall).toMatch(/limited overlap/i);
  });
});
