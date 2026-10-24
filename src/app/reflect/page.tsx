import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { WellbeingPageHeader } from "@/components/wellbeing/WellbeingPageHeader";
import { ReflectPage } from "@/components/wellbeing/ReflectPage";

export const metadata: Metadata = { title: "Reflect · Ra7a" };
export const dynamic = "force-dynamic";

export default async function ReflectRoute() {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  const { data: profile } = await auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  return <><WellbeingPageHeader account={profile?.display_name || auth.user.email || "Your account"}/><ReflectPage/></>;
}
