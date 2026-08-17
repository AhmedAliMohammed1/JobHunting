import { NextResponse } from "next/server";
import { expandSearchQuery } from "@/src/lib/ai/query-expansion";
import { getAIProvider } from "@/src/lib/ai/provider";
import { searchJobs } from "@/src/lib/jobs/search";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { searchRequestSchema, jobSearchSchema } from "@/src/lib/validation/search";

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const limit = rateLimit(`job-search:${forwarded ?? "anonymous"}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many searches. Try again shortly." }, { status: 429 });

  try {
    const input = searchRequestSchema.parse(await request.json());
    let expanded = {};
    if (input.query) {
      try {
        expanded = await expandSearchQuery(getAIProvider(), input.query, []);
      } catch {
        expanded = { roles: [input.query], keywords: [input.query] };
      }
    }
    const query = jobSearchSchema.parse({ ...expanded, ...input.filters });
    const result = await searchJobs(query);
    return NextResponse.json({ ...result, disclosure: query.limit && result.providers.some((p) => p.providerId === "mock") ? "Development fixtures — not live listings." : undefined });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid search request" }, { status: 400 });
  }
}
