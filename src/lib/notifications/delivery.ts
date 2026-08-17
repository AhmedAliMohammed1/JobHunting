import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedJob } from "@/src/types/jobs";

export async function deliverInAppJobAlert(admin: SupabaseClient, userId: string, savedSearchId: string, job: NormalizedJob) {
  const dedupeKey = createHash("sha256").update(`${savedSearchId}:${job.provider}:${job.externalId ?? job.id}`).digest("hex");
  const { data: existing } = await admin.from("notification_deliveries").select("id").eq("user_id", userId).eq("dedupe_key", dedupeKey).eq("channel", "in-app").maybeSingle();
  if (existing) return { delivered: false, reason: "duplicate" as const };
  const { data: notification, error: notificationError } = await admin.from("notifications").insert({ user_id: userId, type: "saved-search-match", title: `${job.title} at ${job.company}`, body: `${job.location ?? "Location not supplied"} · ${job.freshnessLabel}`, data: { savedSearchId, provider: job.provider, externalId: job.externalId, sourceUrl: job.sourceUrl } }).select("id").single();
  if (notificationError || !notification) throw new Error("Notification insert failed");
  const { error: deliveryError } = await admin.from("notification_deliveries").insert({ user_id: userId, notification_id: notification.id, notification_type: "saved-search-match", dedupe_key: dedupeKey, channel: "in-app", status: "sent", sent_at: new Date().toISOString() });
  if (deliveryError) throw new Error("Notification delivery insert failed");
  return { delivered: true };
}
