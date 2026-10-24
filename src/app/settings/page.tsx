import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getDefaultProvider } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  const [{ data: profile }, params] = await Promise.all([
    auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    searchParams,
  ]);
  const savedPreference = auth.user.user_metadata?.raha_provider_preference;
  const providerPreference = savedPreference === "ollama" || savedPreference === "openrouter" ? savedPreference : "";
  let defaultProvider: "ollama" | "openrouter" = "ollama";
  try { defaultProvider = getDefaultProvider(); } catch { /* The invalid setting is reported on chat requests. */ }
  const savedDisplayName = typeof auth.user.user_metadata?.display_name === "string"
    ? auth.user.user_metadata.display_name
    : profile?.display_name || "";
  return <SettingsView email={auth.user.email || "Account email unavailable"} displayName={savedDisplayName} providerPreference={providerPreference} defaultProvider={defaultProvider} error={params.error} saved={params.saved === "1"} providerSaved={params.saved === "provider"} />;
}
