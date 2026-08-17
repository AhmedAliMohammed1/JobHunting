import { createHash } from "node:crypto";
import type { AIProvider } from "./provider";

export function embeddingContentHash(text: string): string {
  return createHash("sha256").update(text.trim().replace(/\s+/g, " ")).digest("hex");
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export async function embedMinimalProfile(provider: AIProvider, profileText: string) {
  return { hash: embeddingContentHash(profileText), vector: await provider.embed(profileText) };
}

