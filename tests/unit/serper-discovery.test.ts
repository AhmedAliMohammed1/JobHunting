import { afterEach, describe, expect, it, vi } from "vitest";
import { createSerperSearchProvider } from "@/src/lib/jobs/providers/serper";

describe("Serper discovery adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses server-side auth, Google site operators, country, language and recency while capping results at ten", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        organic: [{
          title: "Contabo sucht Software Engineer in Deutschland | LinkedIn",
          link: "https://de.linkedin.com/jobs/view/software-engineer-at-contabo-4410824202",
          snippet: "Build cloud software in Germany.",
          date: "2 days ago",
          position: 9,
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("<html><head></head><body></body></html>", { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createSerperSearchProvider("serper-secret-key", 600);
    const results = await provider.search("Software Engineer Germany serper-adapter-test", {
      includeDomains: ["linkedin.com", "de.linkedin.com"],
      postedWithinHours: 168,
      maxResults: 20,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe("https://google.serper.dev/search");
    expect(requestInit?.headers).toMatchObject({ "X-API-KEY": "serper-secret-key", "Content-Type": "application/json" });
    expect(String(requestUrl)).not.toContain("serper-secret-key");
    const body = JSON.parse(String(requestInit?.body));
    expect(body.q).toContain("site:linkedin.com");
    expect(body.q).toContain("site:de.linkedin.com");
    expect(body.gl).toBe("de");
    expect(body.hl).toBe("en");
    expect(body.tbs).toBe("qdr:w");
    expect(body.num).toBe(10);
    expect(String(fetchMock.mock.calls[1][0])).toContain("linkedin.com/jobs/view");
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("linkedin.com/jobs/view");
    expect(results[0].content).toContain("2 days ago");
    expect(results[0].score).toBeUndefined();
  });

  it("throws a provider error for non-success Serper responses", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createSerperSearchProvider("serper-secret-key", 600);
    await expect(provider.search("Data Engineer Egypt serper-error-test", { includeDomains: ["indeed.com"], maxResults: 10 })).rejects.toThrow("Serper returned 429");
  });
});
