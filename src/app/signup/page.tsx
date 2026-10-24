import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Create account · Raha" };

export default async function SignUpPage() {
  if (await getAuthenticatedUser()) redirect("/");
  const configured = Boolean(getSupabasePublicEnv());

  return <main className="settings-shell"><section className="settings-page auth-page" aria-labelledby="auth-title">
    <header className="settings-header"><Link href="/" className="back-button"><span aria-hidden="true">‹</span><span>Raha</span></Link><span className="settings-kicker">YOUR SPACE</span><h1 id="auth-title">Create account</h1><p>Your conversations will be saved to your account.</p></header>
    {!configured && <p className="auth-setup" role="status">Add the Supabase project URL and anon key to the environment before enabling accounts.</p>}
    <AuthForm mode="signup" />
  </section></main>;
}
