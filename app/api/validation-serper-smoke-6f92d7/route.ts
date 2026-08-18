import { getServerEnv } from "@/src/config/env";
import { detectJobSource, isLikelyJobUrl } from "@/src/lib/jobs/providers/discovery";
import { createSerperSearchProvider } from "@/src/lib/jobs/providers/serper";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PATH_QUERIES: Record<string, string[]> = {
  linkedin: [
    'site:linkedin.com/jobs/view "Software Engineer" Germany',
    'site:de.linkedin.com/jobs/view "Software Engineer" Germany',
    'site:linkedin.com inurl:jobs/view "Software Engineer" Germany',
  ],
  indeed: [
    'site:de.indeed.com/viewjob "Software Engineer" Germany',
    'site:indeed.com/viewjob "Software Engineer" Germany',
    'site:indeed.com inurl:viewjob "Software Engineer" Germany',
  ],
  glassdoor: [
    'site:glassdoor.com/job-listing "Software Engineer" Germany',
    'site:glassdoor.de/job-listing "Software Engineer" Germany',
    'site:glassdoor.com inurl:job-listing "Software Engineer" Germany',
  ],
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
) {
  try {
    const rows = await serper.search(query, { maxResults: 10, searchDepth: "advanced" });
    return { ok: true, query, count: rows.length, validCount: rows.filter((row) => isLikelyJobUrl(row.url)).length, rows: sanitize(rows) };
  } catch (error) {
    return { ok: false, query, error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function GET() {
  const env = getServerEnv();
  if (!env.SERPER_API_KEY) return Response.json({ error: "SERPER_API_KEY is not configured" }, { status: 503 });
  const serper = createSerperSearchProvider(env.SERPER_API_KEY, 60);
  const diagnostics: Record<string, unknown> = {};

  for (const [source, queries] of Object.entries(PATH_QUERIES)) {
    diagnostics[source] = await Promise.all(queries.map((query) => attempt(serper, query)));
  }

  return Response.json({ testedAt: new Date().toISOString(), diagnostics });
}
