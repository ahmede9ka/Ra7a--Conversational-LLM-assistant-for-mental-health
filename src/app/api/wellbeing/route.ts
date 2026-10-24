import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createRecordSchema } from "@/lib/wellbeing/validation";
import type { Json } from "@/lib/supabase/database.types";
import { readWellbeingJson } from "@/lib/wellbeing/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowedTypes = new Set(["mood", "reflection", "activity", "exercise", "weekly_reflection"]);

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in to view your saved wellbeing records." }, { status: 401 });
  const requestedTypes = new URL(request.url).searchParams.getAll("type");
  const types = requestedTypes.filter((type) => allowedTypes.has(type));
  if (requestedTypes.length && types.length !== requestedTypes.length) return NextResponse.json({ error: "Choose a supported record type." }, { status: 400 });
  let query = auth.supabase.from("wellbeing_records").select("id,record_type,data,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(200);
  if (types.length) query = query.in("record_type", types as ("mood" | "reflection" | "activity" | "exercise" | "weekly_reflection")[]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Your saved records could not be loaded." }, { status: 503 });
  return NextResponse.json({ records: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in to save this." }, { status: 401 });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return NextResponse.json({ error: "Please send a JSON record." }, { status: 415 });
  let body: unknown;
  try { body = await readWellbeingJson(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "too_large" ? "This entry is too long. Please shorten it and try again." : "Please check the entry and try again." }, { status: error instanceof Error && error.message === "too_large" ? 413 : 400 }); }
  const parsed = createRecordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Some details are missing or invalid. Please review the form." }, { status: 400 });
  const { recordType, data } = parsed.data;
  const { data: record, error } = await auth.supabase.from("wellbeing_records").insert({ user_id: auth.user.id, record_type: recordType, data: data as Json }).select("id,record_type,data,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "Your entry could not be saved. Please try again." }, { status: 503 });
  return NextResponse.json({ record }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
