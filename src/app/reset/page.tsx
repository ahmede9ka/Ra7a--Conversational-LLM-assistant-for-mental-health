import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { WellbeingPageHeader } from "@/components/wellbeing/WellbeingPageHeader";
import { WellbeingNav } from "@/components/wellbeing/WellbeingNav";
import { ResetExperience } from "@/components/wellbeing/ResetExperience";

export const metadata: Metadata = { title: "Reset · Ra7a" };
export const dynamic = "force-dynamic";

export default async function ResetRoute() {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  const { data: profile } = await auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  return <><WellbeingPageHeader account={profile?.display_name || auth.user.email || "Your account"}/><main className="page-shell wellbeing-shell"><WellbeingNav active="/reset"/><section className="feature-page" aria-labelledby="reset-page-title"><header className="feature-page-heading"><span className="section-kicker">RESET</span><h1 id="reset-page-title">A gentle pause, your way.</h1><p>Try a short guide, or simply take a quiet moment. Nothing here is required.</p></header><ResetExperience/></section></main></>;
}
