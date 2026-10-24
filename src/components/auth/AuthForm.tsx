"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, signUpAction } from "@/app/auth/actions";
import type { AuthActionState } from "@/lib/auth/validation";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Please wait…" : label}</button>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction] = useActionState<AuthActionState, FormData>(action, {});
  const isSignUp = mode === "signup";

  return (
    <form action={formAction} className="auth-form">
      {isSignUp && <label>Name <input name="display_name" autoComplete="name" maxLength={80} /></label>}
      <label>Email <input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Password <input name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={8} maxLength={72} required /></label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.message && <p className="auth-message" role="status">{state.message}</p>}
      <SubmitButton label={isSignUp ? "Create account" : "Sign in"} />
      <p className="auth-switch">{isSignUp ? "Already have an account?" : "New to Raha?"} <Link href={isSignUp ? "/login" : "/signup"}>{isSignUp ? "Sign in" : "Create an account"}</Link></p>
      <p className="auth-privacy">Your conversations are stored in your account and sent to OpenRouter to generate replies. Review the provider’s privacy practices before sharing sensitive details.</p>
    </form>
  );
}
