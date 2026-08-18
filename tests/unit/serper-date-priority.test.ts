import { afterEach, describe, expect, it, vi } from "vitest";
import { createSerperSearchProvider } from "@/src/lib/jobs/providers/serper";

describe("Serper posting-date priority", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("normalizes the dedicated result date instead of dates mentioned in the snippet", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T02:00:00.000Z"));

    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      organic: [{
        title: "Software Engineer at Example | LinkedIn",
        link: "https://de.linkedin.com/jobs/view/software-engineer-at-example-4453075923",
        snippet: "Related role in Munich Vor 2 Wochen. This is the target listing.",
        date: "1 day ago",
        position: 1,
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createSerperSearchProvider("secret", 60);
    const rows = await provider.search("Software Engineer Germany", { maxResults: 10 });

    expect(rows[0].publishedDate).toBe("2026-08-17T02:00:00.000Z");
    expect(rows[0].content).toContain("Vor 2 Wochen");
  });
});
