"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { signInSchema, signUpSchema, type AuthActionState } from "@/lib/auth/validation";

function getField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function signInAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!getSupabasePublicEnv()) return { error: "Authentication is not configured yet. Add the Supabase URL and anon key to the server environment." };
  const parsed = signInSchema.safeParse({ email: getField(formData, "email"), password: getField(formData, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Check your email and password." };

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "We couldn't sign you in with those details. Check them and try again." };
  } catch {
    return { error: "Sign in is temporarily unavailable. Please try again." };
  }
  redirect("/");
}

export async function signUpAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!getSupabasePublicEnv()) return { error: "Authentication is not configured yet. Add the Supabase URL and anon key to the server environment." };
  const parsed = signUpSchema.safeParse({
    email: getField(formData, "email"),
    password: getField(formData, "password"),
    displayName: getField(formData, "display_name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Check your details and try again." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName || null },
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });
    if (error) return { error: "We couldn't create your account with those details. Check them and try again." };
    if (data.session) redirect("/");
    return { message: "Account created. If email confirmation is enabled, follow the link from Supabase before signing in." };
  } catch (error) {
    // Next redirect signals are thrown exceptions and must pass through unchanged.
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Sign up is temporarily unavailable. Please try again." };
  }
}

export async function signOutAction() {
  if (getSupabasePublicEnv()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Redirect regardless so a stale browser session does not keep showing private app UI.
    }
  }
  redirect("/login");
}

export async function updateDisplayNameAction(formData: FormData) {
  if (!getSupabasePublicEnv()) redirect("/login");
  const displayName = getField(formData, "display_name").trim();
  if (displayName.length > 80) redirect("/settings?error=name");
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { error: metadataError } = await supabase.auth.updateUser({ data: { display_name: displayName || null } });
    if (metadataError) redirect("/settings?error=save");
    // Keep the profile row in sync when available. Auth metadata remains the durable source,
    // so an absent or not-yet-migrated profile row cannot make the save appear successful but disappear.
    await supabase.from("profiles").update({ display_name: displayName || null }).eq("id", user.id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/settings?error=save");
  }
  redirect("/settings?saved=1");
}

export async function updateProviderPreferenceAction(formData: FormData) {
  if (!getSupabasePublicEnv()) redirect("/login");
  const provider = getField(formData, "provider");
  if (provider !== "ollama" && provider !== "openrouter") redirect("/settings?error=provider");
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { error } = await supabase.auth.updateUser({ data: { raha_provider_preference: provider } });
    if (error) redirect("/settings?error=provider");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/settings?error=provider");
  }
  redirect("/settings?saved=provider");
}
