import { getServerEnv } from "@/src/config/env";
import { detectJobSource, isLikelyJobUrl } from "@/src/lib/jobs/providers/discovery";
import { createSerperSearchProvider } from "@/src/lib/jobs/providers/serper";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type SourceSpec = { label: string; domains: string[] };
const SOURCES: Record<string, SourceSpec> = {
  linkedin: { label: "LinkedIn Jobs", domains: ["linkedin.com", "de.linkedin.com"] },
  indeed: { label: "Indeed Jobs", domains: ["indeed.com", "de.indeed.com"] },
  glassdoor: { label: "Glassdoor Jobs", domains: ["glassdoor.com", "glassdoor.de"] },
};

function sanitize(rows: Awaited<ReturnType<ReturnType<typeof createSerperSearchProvider>["search"]>>) {
  return rows.map((row) => ({
    title: row.title,
    url: row.url,
    detectedSource: detectJobSource(row.url),
    likelyJobUrl: isLikelyJobUrl(row.url),
    content: row.content?.slice(0, 180),
  }));
}

async function attempt(
  serper: ReturnType<typeof createSerperSearchProvider>,
  query: string,
  options: Parameters<ReturnType<typeof createSerperSearchProvider>["search"]>[1],
) {
  try {
    const rows = await serper.search(query, options);
    return { ok: true, count: rows.length, rows: sanitize(rows) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function GET() {
  const env = getServerEnv();
  if (!env.SERPER_API_KEY) return Response.json({ error: "SERPER_API_KEY is not configured" }, { status: 503 });
  const serper = createSerperSearchProvider(env.SERPER_API_KEY, 60);

  const diagnostics: Record<string, unknown> = {};
  for (const [source, spec] of Object.entries(SOURCES)) {
    diagnostics[source] = {
      primary10: await attempt(serper, "Software Engineer job opening Germany", {
        includeDomains: spec.domains,
        maxResults: 10,
        searchDepth: "advanced",
      }),
      primary12: await attempt(serper, "Software Engineer job opening Germany", {
        includeDomains: spec.domains,
        maxResults: 12,
        searchDepth: "advanced",
      }),
      fallback10: await attempt(serper, `${spec.label} Software Engineer Germany`, {
        maxResults: 10,
        searchDepth: "advanced",
      }),
    };
  }

  return Response.json({ testedAt: new Date().toISOString(), diagnostics });
}
