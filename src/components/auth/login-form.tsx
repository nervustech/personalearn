"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  loginSchema,
  signupSchema,
  type LoginFormValues,
  type SignupFormValues,
} from "@/lib/validations/auth";
import { GoogleIcon } from "@/components/auth/google-icon";
import { OAuthSetupCallout } from "@/components/auth/oauth-setup-callout";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const authError = searchParams.get("error") === "auth";
  const authErrorCode = searchParams.get("error_code");
  const authErrorDetail = searchParams.get("error_detail");

  function getAuthErrorMessage(): string | null {
    if (!authError) return null;
    if (authErrorDetail?.includes("Unable to exchange external code")) {
      return "Google sign-in failed: Supabase could not verify your Google OAuth credentials. Follow the setup steps below.";
    }
    if (authErrorDetail) {
      return `Authentication failed: ${authErrorDetail}`;
    }
    if (authErrorCode) {
      return `Authentication failed (${authErrorCode}). Please try again.`;
    }
    return "Authentication failed. Please try again.";
  }

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(getAuthErrorMessage());

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", fullName: "" },
  });

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError(null);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  async function handleEmailLogin(values: LoginFormValues) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(values);
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleEmailSignup(values: SignupFormValues) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "login"
            ? "Welcome back to your CBC teaching co-pilot."
            : "Start planning smarter lessons in minutes."}
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1"
        role="tablist"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            mode === "login"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => switchMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            mode === "signup"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => switchMode("signup")}
        >
          Create account
        </button>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {authErrorDetail?.includes("Unable to exchange external code") ? (
        <OAuthSetupCallout />
      ) : null}

      <section className="space-y-3" aria-label="Social sign in">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quick sign in
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full border-border/80 bg-background/80 hover:bg-background"
          disabled={loading}
          onClick={handleGoogleSignIn}
        >
          <GoogleIcon className="h-5 w-5" />
          Continue with Google
        </Button>
      </section>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/90 px-3 text-muted-foreground dark:bg-slate-950/90">
            or continue with email
          </span>
        </div>
      </div>

      <section aria-label={mode === "login" ? "Email sign in" : "Email sign up"}>
        {mode === "login" ? (
          <form
            className="space-y-4"
            onSubmit={loginForm.handleSubmit(handleEmailLogin)}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@school.ke"
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email ? (
                <p className="text-xs text-destructive">
                  {loginForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password ? (
                <p className="text-xs text-destructive">
                  {loginForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Sign in with email
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={signupForm.handleSubmit(handleEmailSignup)}
          >
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Jane Wanjiku"
                {...signupForm.register("fullName")}
              />
              {signupForm.formState.errors.fullName ? (
                <p className="text-xs text-destructive">
                  {signupForm.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@school.ke"
                {...signupForm.register("email")}
              />
              {signupForm.formState.errors.email ? (
                <p className="text-xs text-destructive">
                  {signupForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...signupForm.register("password")}
              />
              {signupForm.formState.errors.password ? (
                <p className="text-xs text-destructive">
                  {signupForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Create account
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
