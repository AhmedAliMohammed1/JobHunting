import { describe, expect, it } from "vitest";
import { persistNormalizedJob } from "@/src/lib/jobs/persistence";
import type { NormalizedJob } from "@/src/types/jobs";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("job persistence adapter", () => {
  it("upserts the canonical job, source, and skills", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const admin = { from(table: string) { return { upsert(payload: unknown) { writes.push({ table, payload }); if (table === "jobs") return { select() { return { async single() { return { data: { id: "6d6a0fb4-04b3-4c3b-9a42-232cf2d132b8" }, error: null }; } }; } }; return { error: null }; } }; } } as unknown as SupabaseClient;
    const job: NormalizedJob = { id: "1", externalId: "ext", provider: "feed", title: "Engineer", company: "Acme", workplaceType: "remote", skills: ["TypeScript", "React"], firstDiscoveredAt: "2026-08-17T00:00:00.000Z", lastSeenAt: "2026-08-17T00:00:00.000Z", sourceUrl: "https://jobs.example/1", status: "ACTIVE", freshnessLabel: "live" };
    await expect(persistNormalizedJob(admin, job)).resolves.toBe("6d6a0fb4-04b3-4c3b-9a42-232cf2d132b8");
    expect(writes.map((write) => write.table)).toEqual(["jobs", "job_sources", "job_skills"]);
  });
});
