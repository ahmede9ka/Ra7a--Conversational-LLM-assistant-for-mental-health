import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { WellbeingPageHeader } from "@/components/wellbeing/WellbeingPageHeader";
import { WellbeingNav } from "@/components/wellbeing/WellbeingNav";
import { ProgressDashboard } from "@/components/wellbeing/ProgressDashboard";

export const metadata: Metadata = { title: "My Progress · Ra7a" };
export const dynamic = "force-dynamic";

export default async function ProgressRoute() {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  const { data: profile } = await auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  return <><WellbeingPageHeader account={profile?.display_name || auth.user.email || "Your account"}/><main className="page-shell wellbeing-shell"><WellbeingNav active="/progress"/><section className="feature-page" aria-labelledby="progress-page-title"><header className="feature-page-heading"><span className="section-kicker">MY PROGRESS</span><h1 id="progress-page-title">A record of your own steps.</h1><p>Just the information you chose to save. Nothing here is a score or a measure of recovery.</p></header><ProgressDashboard/></section></main></>;
}
