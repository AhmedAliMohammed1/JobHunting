import { NextResponse } from "next/server";
import { z } from "zod";
import { isFeatureEnabled } from "@/src/config/features";
import { getCurrentUser } from "@/src/lib/auth/user";
import { isAuthorizedWorker } from "@/src/lib/auth/worker";
import { createAdminClient } from "@/src/lib/database/supabase/admin";
import { createClient } from "@/src/lib/database/supabase/server";
import { requireHttpsUrl } from "@/src/lib/security/urls";

const enqueueSchema = z.object({
  applicationId: z.string().uuid(),
  applicationUrl: z.string().url(),
  dryRun: z.literal(true),
  allowlistedDomains: z.array(z.string().min(1)).min(1).max(20),
  fields: z.array(z.object({ id: z.string().max(200), label: z.string().max(500), value: z.string().max(20_000).optional(), required: z.boolean(), sensitive: z.boolean().optional() })).max(200),
});

export async function GET(request: Request) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
  const { data, error } = await admin.rpc("claim_automation_task");
  if (error) return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ id: row.id, ...row.payload });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeatureEnabled("BROWSER_AUTOMATION")) return NextResponse.json({ error: "Browser automation is disabled." }, { status: 403 });
  try {
    const input = enqueueSchema.parse(await request.json());
    const url = requireHttpsUrl(input.applicationUrl);
    if (!input.allowlistedDomains.includes(url.hostname)) return NextResponse.json({ error: "Application domain is not allowlisted." }, { status: 400 });
    if (input.fields.some((field) => field.sensitive && field.value)) return NextResponse.json({ error: "Sensitive answers must not be queued." }, { status: 400 });
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
    const idempotencyKey = `${user.id}:${input.applicationId}:dry-run`;
    const { data, error } = await supabase.from("automation_tasks").upsert({ user_id: user.id, application_id: input.applicationId, task_type: "dry-run", status: "queued", idempotency_key: idempotencyKey, payload: { url: input.applicationUrl, dryRun: true, fields: input.fields, allowlistedDomains: input.allowlistedDomains } }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id,status").single();
    if (error) return NextResponse.json({ error: "Could not queue the dry run." }, { status: 500 });
    return NextResponse.json(data, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Invalid dry-run request." }, { status: 400 });
  }
}
