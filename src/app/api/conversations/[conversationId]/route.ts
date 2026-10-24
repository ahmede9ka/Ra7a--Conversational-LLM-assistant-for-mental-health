import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  if (!idSchema.safeParse(conversationId).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });

  const { data: conversation, error: conversationError } = await auth.supabase.from("conversations").select("id,title,updated_at").eq("id", conversationId).eq("user_id", auth.user.id).maybeSingle();
  if (conversationError) return NextResponse.json({ error: "Conversation couldn't be loaded." }, { status: 503 });
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data, error } = await auth.supabase.from("messages").select("id,role,content,created_at,request_id").eq("conversation_id", conversation.id).eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(40);
  if (error) return NextResponse.json({ error: "Conversation couldn't be loaded." }, { status: 503 });
  return NextResponse.json({ conversation, messages: data.reverse() });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  if (!idSchema.safeParse(conversationId).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });

  const { data, error } = await auth.supabase.from("conversations").delete().eq("id", conversationId).eq("user_id", auth.user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Conversation couldn't be deleted." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
