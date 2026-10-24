import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in to start a conversation." }, { status: 401 });

  const { data, error } = await auth.supabase.from("conversations").insert({ user_id: auth.user.id, title: "New conversation" }).select("id,title,updated_at").single();
  if (error || !data) return NextResponse.json({ error: "A new conversation couldn't be created. Please try again." }, { status: 503 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
