import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sign in · Raha" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAuthenticatedUser()) redirect("/");
  const configured = Boolean(getSupabasePublicEnv());
  const { error } = await searchParams;

  return <main className="settings-shell"><section className="settings-page auth-page" aria-labelledby="auth-title">
    <header className="settings-header"><Link href="/" className="back-button"><span aria-hidden="true">‹</span><span>Raha</span></Link><span className="settings-kicker">A SPACE TO PAUSE</span><h1 id="auth-title">Welcome back</h1><p>Sign in to continue your conversations.</p></header>
    {!configured && <p className="auth-setup" role="status">Add the Supabase project URL and anon key to the environment before enabling accounts.</p>}
    {error === "callback" && <p className="auth-setup" role="alert">That sign-in link could not be verified. Please try again or request a fresh link.</p>}
    {error === "session" && <p className="auth-setup" role="alert">Your session ended. Please sign in again.</p>}
    <AuthForm mode="login" />
  </section></main>;
}
