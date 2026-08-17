import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedWorker } from "@/src/lib/auth/worker";
import { createAdminClient } from "@/src/lib/database/supabase/admin";

const resultSchema = z.object({
  taskId: z.string().uuid(),
  outcome: z.enum(["READY", "WAITING_FOR_USER", "CAPTCHA_REQUIRED", "OTP_REQUIRED", "LOGIN_REQUIRED", "UNSUPPORTED", "FAILED"]),
  message: z.string().max(1000),
  evidence: z.object({ finalUrl: z.string().url(), screenshotPath: z.string().max(1000).optional() }).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const result = resultSchema.parse(await request.json());
    if (result.taskId !== id) return NextResponse.json({ error: "Task mismatch" }, { status: 409 });
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
    const terminal = result.outcome === "READY" ? "completed" : result.outcome === "FAILED" ? "failed" : "waiting";
    const { error } = await admin.from("automation_tasks").update({ status: terminal, completed_at: terminal === "completed" ? new Date().toISOString() : null, payload: { workerResult: result } }).eq("id", id).eq("status", "running");
    if (error) return NextResponse.json({ error: "Could not update task." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Invalid worker result." }, { status: 400 }); }
}
