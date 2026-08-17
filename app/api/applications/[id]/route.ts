import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { applicationUpdateSchema, idSchema } from "@/src/lib/validation/product";

const stageToState = { Saved: "DISCOVERED", Planning: "PREPARING", Applying: "PREPARING", Applied: "SUBMITTED", Assessment: "CONFIRMED", Interview: "CONFIRMED", Offer: "CONFIRMED", Rejected: "CONFIRMED", Withdrawn: "CONFIRMED" } as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  const input = applicationUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return NextResponse.json({ error: "Invalid application update." }, { status: 400 });
  const supabase = await createClient();
  const now = new Date().toISOString();
  const update = { stage: input.data.stage, state: stageToState[input.data.stage], applied_at: input.data.stage === "Applied" ? now : undefined };
  const { data, error } = await supabase!.from("applications").update(update).eq("id", id.data).eq("user_id", user.id).select("id,stage,state,updated_at").single();
  if (error) return NextResponse.json({ error: "Could not update the application." }, { status: 500 });
  return NextResponse.json({ application: data });
}
