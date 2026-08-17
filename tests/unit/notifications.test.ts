import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverInAppJobAlert } from "@/src/lib/notifications/delivery";
import type { NormalizedJob } from "@/src/types/jobs";

const job: NormalizedJob = { id: "1", externalId: "ext", provider: "feed", title: "Engineer", company: "Acme", location: "Remote", workplaceType: "remote", skills: [], firstDiscoveredAt: "2026-08-17T00:00:00.000Z", lastSeenAt: "2026-08-17T00:00:00.000Z", sourceUrl: "https://jobs.example/1", status: "ACTIVE", freshnessLabel: "live" };

function selectChain(result: unknown) {
  const api = { select: () => api, eq: () => api, async maybeSingle() { return { data: result, error: null }; } };
  return api;
}

describe("notification delivery", () => {
  it("deduplicates an already delivered saved-search match", async () => {
    const admin = { from: () => selectChain({ id: "existing" }) } as unknown as SupabaseClient;
    await expect(deliverInAppJobAlert(admin, "user", "search", job)).resolves.toEqual({ delivered: false, reason: "duplicate" });
  });

  it("records a notification and delivery receipt", async () => {
    let deliveryCalls = 0;
    const admin = { from(table: string) {
      if (table === "notifications") return { insert: () => ({ select: () => ({ async single() { return { data: { id: "notification" }, error: null }; } }) }) };
      deliveryCalls += 1;
      if (deliveryCalls === 1) return selectChain(null);
      return { async insert() { return { error: null }; } };
    } } as unknown as SupabaseClient;
    await expect(deliverInAppJobAlert(admin, "user", "search", job)).resolves.toEqual({ delivered: true });
  });
});
