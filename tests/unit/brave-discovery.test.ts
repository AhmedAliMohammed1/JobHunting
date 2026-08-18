import { afterEach, describe, expect, it, vi } from "vitest";
import { createBraveSearchProvider } from "@/src/lib/jobs/providers/brave";

describe("Brave Search discovery adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the official web-search endpoint with server-side auth, site operators, country and freshness", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      web: {
        results: [{
          title: "Contabo sucht Software Engineer in Deutschland | LinkedIn",
          url: "https://de.linkedin.com/jobs/view/software-engineer-at-contabo-4410824202",
          description: "Build cloud software in Germany.",
          age: "2 days ago",
          extra_snippets: ["Full-time role"],
        }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createBraveSearchProvider("brave-secret-key", 600);
    const results = await provider.search("Software Engineer Germany brave-adapter-test", {
      includeDomains: ["linkedin.com", "de.linkedin.com"],
      postedWithinHours: 168,
      maxResults: 20,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(`${url.origin}${url.pathname}`).toBe("https://api.search.brave.com/res/v1/web/search");
    expect(url.searchParams.get("q")).toContain("site:linkedin.com");
    expect(url.searchParams.get("q")).toContain("site:de.linkedin.com");
    expect(url.searchParams.get("country")).toBe("DE");
    expect(url.searchParams.get("freshness")).toBe("pw");
    expect(url.searchParams.get("count")).toBe("20");
    expect(requestInit?.headers).toMatchObject({ "X-Subscription-Token": "brave-secret-key" });
    expect(String(requestUrl)).not.toContain("brave-secret-key");
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("linkedin.com/jobs/view");
    expect(results[0].content).toContain("2 days ago");
  });

  it("throws a provider error for non-success Brave responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response("rate limited", { status: 429 })));
    const provider = createBraveSearchProvider("brave-secret-key", 600);

    await expect(provider.search("Data Engineer Egypt brave-error-test", {
      includeDomains: ["indeed.com"],
      maxResults: 10,
    })).rejects.toThrow("Brave Search returned 429");
  });
});
