import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  const { data: profile } = await auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  return <SettingsView email={auth.user.email || "Account email unavailable"} displayName={profile?.display_name || ""} error={searchParams.error} saved={searchParams.saved === "1"} />;
}
