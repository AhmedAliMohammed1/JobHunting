export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BASE = "https://job-hunting-two-gamma.vercel.app/api/jobs/search";
const QUERY = "Software Engineer Germany last 7 days";

type SearchResponse = {
  jobs?: Array<{ provider?: string; sourceUrl?: string }>;
  partial?: boolean;
  providers?: Array<{ providerId?: string; ok?: boolean; jobsReturned?: number; errorCode?: string | null }>;
};

async function runSearch(provider?: string): Promise<SearchResponse> {
  const filters: { limit: number; providers?: string[] } = { limit: 50 };
  if (provider) filters.providers = [provider];
  const response = await fetch(BASE, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, filters }),
  });
  if (!response.ok) throw new Error(`${provider ?? "all"} search returned ${response.status}: ${await response.text()}`);
  return (await response.json()) as SearchResponse;
}

function summarize(response: SearchResponse) {
  const jobs = response.jobs ?? [];
  return {
    jobCount: jobs.length,
    partial: response.partial ?? false,
    providerHealth: (response.providers ?? []).map(({ providerId, ok, jobsReturned, errorCode }) => ({ providerId, ok, jobsReturned, errorCode })),
    countsBySource: Object.entries(jobs.reduce<Record<string, number>>((counts, job) => {
      const source = job.provider ?? "unknown";
      counts[source] = (counts[source] ?? 0) + 1;
      return counts;
    }, {})).map(([provider, count]) => ({ provider, count })),
    sampleUrls: jobs.slice(0, 5).map((job) => job.sourceUrl).filter(Boolean),
  };
}

export async function GET() {
  try {
    const all = await runSearch();
    const linkedin = await runSearch("linkedin");
    const indeed = await runSearch("indeed");
    const xing = await runSearch("xing");
    const stepstone = await runSearch("stepstone");
    const glassdoor = await runSearch("glassdoor");
    return Response.json({
      testedAt: new Date().toISOString(),
      query: QUERY,
      all: summarize(all),
      linkedin: summarize(linkedin),
      indeed: summarize(indeed),
      xing: summarize(xing),
      stepstone: summarize(stepstone),
      glassdoor: summarize(glassdoor),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown validation error" }, { status: 500 });
  }
}
