import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");

  const [{ data: profile, error: profileError }, { data: conversations, error: conversationsError }] = await Promise.all([
    auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("conversations").select("id,title,updated_at").eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(50),
  ]);
  if (profileError || conversationsError) {
    return <main className="settings-shell"><section className="settings-page" role="alert"><h1>Raha is not ready yet</h1><p>Finish the Supabase database setup and migrations, then refresh this page.</p></section></main>;
  }

  const latest = conversations[0] || null;
  let initialMessages: Pick<Database["public"]["Tables"]["messages"]["Row"], "id" | "role" | "content" | "created_at" | "request_id">[] = [];
  if (latest) {
    const { data, error } = await auth.supabase.from("messages").select("id,role,content,created_at,request_id").eq("conversation_id", latest.id).eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(40);
    if (error) return <main className="settings-shell"><section className="settings-page" role="alert"><h1>Conversation history is unavailable</h1><p>Please refresh in a moment. Your saved conversations have not been deleted.</p></section></main>;
    initialMessages = data.reverse();
  }

  return <ChatWorkspace
    initialConversations={conversations}
    initialConversationId={latest?.id || null}
    initialMessages={initialMessages}
    email={auth.user.email || "Your account"}
    displayName={profile?.display_name || null}
  />;
}
