"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Command, LoaderCircle } from "lucide-react";
import { createClient } from "@/src/lib/database/supabase/client";
import { safeReturnPath } from "@/src/lib/auth/paths";
import { passwordUpdateSchema, registrationSchema, resetRequestSchema, signInSchema } from "@/src/lib/validation/auth";

type Mode = "login" | "register" | "forgot" | "reset";

const copy: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login: { title: "Welcome back", subtitle: "Continue your private job search workspace.", button: "Sign in" },
  register: { title: "Create your workspace", subtitle: "Start with your profile. Automation stays off until you choose otherwise.", button: "Create account" },
  forgot: { title: "Reset your password", subtitle: "We’ll send a secure reset link to your email.", button: "Send reset link" },
  reset: { title: "Choose a new password", subtitle: "Use at least 12 characters for a stronger account.", button: "Update password" },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const configurationMissing = !createClient();
  const queryError = searchParams.get("error");
  const initialError = queryError === "confirmation_failed" ? "The confirmation link is invalid or expired. Request a new one." : queryError === "configuration" ? "Authentication is not configured for this deployment." : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = createClient();

    const credentials = mode === "login" ? signInSchema.safeParse({ email, password }) : mode === "register" ? registrationSchema.safeParse({ email, password }) : mode === "forgot" ? resetRequestSchema.safeParse({ email }) : passwordUpdateSchema.safeParse({ password });
    if (!credentials.success) {
      setError(credentials.error.issues[0]?.message ?? "Check the form fields.");
      setPending(false);
      return;
    }

    if (!supabase) {
      setError("Authentication is not configured in this environment.");
      setPending(false);
      return;
    }

    try {
      if (mode === "login") {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        router.replace(safeReturnPath(searchParams.get("returnTo")));
        router.refresh();
      } else if (mode === "register") {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
        });
        if (result.error) throw result.error;
        setMessage("Check your email to verify your account and continue.");
      } else if (mode === "forgot") {
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (result.error) throw result.error;
        setMessage("If an account exists for that address, a reset link is on its way.");
      } else {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t complete that request.");
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    setPending(true);
    setError(undefined);
    const supabase = createClient();
    if (!supabase) {
      setError("Authentication is not configured in this environment.");
      setPending(false);
      return;
    }
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (result.error) {
      setError(result.error.message);
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark"><Command size={18} /></span>
          <span>JobHunter</span><span className="brand-ai">AI</span>
        </Link>
        <div className="auth-story-copy">
          <span className="auth-kicker">Private by design</span>
          <h1>Find better roles.<br />Apply with confidence.</h1>
          <p>One focused workspace for discovery, matching, truthful application prep, and safe automation.</p>
          <div className="auth-trust-list">
            <span>Auto Apply starts off</span>
            <span>Sensitive answers are never inferred</span>
            <span>Your CV remains private</span>
          </div>
        </div>
        <small>Built for careful, high-quality job searches.</small>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="mobile-auth-logo"><Command size={18} /></span>
          <h2>{copy[mode].title}</h2>
          <p>{copy[mode].subtitle}</p>

          {configurationMissing ? (
            <div className="auth-notice">Authentication setup required: connect Supabase to enable sign-in.</div>
          ) : null}
          {message ? <div className="auth-success" role="status">{message}</div> : null}
          {error || initialError ? <div className="auth-error" role="alert">{error ?? initialError}</div> : null}

          {mode === "login" || mode === "register" ? (
            <>
              <button className="google-button" onClick={signInWithGoogle} disabled={pending} type="button">
                <span className="google-g">G</span> Continue with Google
              </button>
              <div className="auth-divider"><span>or continue with email</span></div>
            </>
          ) : null}

          <form className="auth-form" onSubmit={onSubmit}>
            {mode !== "reset" ? (
              <label>
                Email address
                <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
            ) : null}
            {mode !== "forgot" ? (
              <label>
                {mode === "reset" ? "New password" : "Password"}
                <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 8 : 12} required />
              </label>
            ) : null}
            {mode === "login" ? <Link className="forgot-link" href="/forgot-password">Forgot password?</Link> : null}
            <button className="auth-submit" disabled={pending} type="submit">
              {pending ? <LoaderCircle className="spin" size={18} /> : null}
              {copy[mode].button}<ArrowRight size={17} />
            </button>
          </form>

          <div className="auth-footer">
            {mode === "login" ? <>New to JobHunter AI? <Link href="/register">Create an account</Link></> : null}
            {mode === "register" ? <>Already have an account? <Link href="/login">Sign in</Link></> : null}
            {mode === "forgot" || mode === "reset" ? <Link href="/login">Back to sign in</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
