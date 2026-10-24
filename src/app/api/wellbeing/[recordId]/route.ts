import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { updateRecordSchema } from "@/lib/wellbeing/validation";
import type { Json } from "@/lib/supabase/database.types";
import { readWellbeingJson } from "@/lib/wellbeing/request";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in to update this." }, { status: 401 });
  const { recordId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(recordId)) return NextResponse.json({ error: "That record could not be found." }, { status: 404 });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return NextResponse.json({ error: "Please send a JSON record." }, { status: 415 });
  let body: unknown;
  try { body = await readWellbeingJson(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "too_large" ? "This entry is too long. Please shorten it and try again." : "Please check the entry and try again." }, { status: error instanceof Error && error.message === "too_large" ? 413 : 400 }); }
  const parsed = updateRecordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Some details are missing or invalid. Please review the entry." }, { status: 400 });
  const { recordType, data } = parsed.data;
  const { data: record, error } = await auth.supabase.from("wellbeing_records").update({ data: data as Json }).eq("id", recordId).eq("user_id", auth.user.id).eq("record_type", recordType).select("id,record_type,data,created_at,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Your entry could not be updated." }, { status: 503 });
  if (!record) return NextResponse.json({ error: "That record could not be found." }, { status: 404 });
  return NextResponse.json({ record }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in to delete this." }, { status: 401 });
  const { recordId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(recordId)) return NextResponse.json({ error: "That record could not be found." }, { status: 404 });
  const { data, error } = await auth.supabase.from("wellbeing_records").delete().eq("id", recordId).eq("user_id", auth.user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Your entry could not be deleted." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "That record could not be found." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
