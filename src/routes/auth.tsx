import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hourglass } from "@/components/Hourglass";
import { Loader2 } from "lucide-react";
import { hasNativeGoogleSignIn, nativeGoogleSignIn } from "@/lib/native-auth";
import { setPendingReferral } from "@/lib/pending-referral";
import { WELCOME_DEMO, REFERRAL_BONUS, formatINR } from "@/lib/commitx-store";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "CommitX — Sign in" },
      { name: "description", content: "Sign in to CommitX and keep one promise at a time." },
      { property: "og:title", content: "CommitX — Sign in" },
      { property: "og:description", content: "Sign in to CommitX and keep one promise at a time." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referral, setReferral] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        setPendingReferral(referral);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          setNotice("Account created. You can start committing now.");
          router.navigate({ to: "/" });
          return;
        }
        // No session returned — sign in with the same credentials.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setNotice(
            "Account created. Check your email to confirm, then sign in.",
          );
          setMode("signin");
          return;
        }
        setNotice("Account created. You can start committing now.");
        router.navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError(null);
    setNotice(null);
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setError("Enter your registered email above, then tap Forgot password.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      // Never reveal whether the address has an account.
      setNotice(
        "If that email is registered, a password reset link is on its way. Check your inbox and spam folder.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send the reset email. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    // Android shell: native Google Sign-In (Credential Manager) — never a browser.
    if (mode === "signup") setPendingReferral(referral);
    if (hasNativeGoogleSignIn()) {
      setBusy(true);
      try {
        await nativeGoogleSignIn();
        router.navigate({ to: "/" });
        return;
      } catch {
        setError("Google sign-in failed. Please try again.");
        return;
      } finally {
        setBusy(false);
      }
    }
    // Web: Google OAuth straight through our own auth domain (no third-party
    // OAuth broker host), so the flow stays on HTTPS URLs we control.
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { prompt: "select_account" },
      },
    });
    setBusy(false);
    if (error) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-14">
        <div className="flex flex-col items-center">
          <Hourglass size={120} state="idle" />
          <h1 className="mt-6 font-display text-3xl font-semibold">CommitX</h1>
          <p className="mt-2 text-sm text-muted-foreground">Commit. Complete. Get it back.</p>
        </div>

        <form onSubmit={submit} className="mt-10 rounded-3xl bg-card p-6 shadow-soft">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mb-3 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          )}

          {mode === "signup" && (
            <div className="mb-3">
              <input
                value={referral}
                onChange={(e) => setReferral(e.target.value.toUpperCase())}
                placeholder="Referral code (optional)"
                autoCapitalize="characters"
                className="w-full rounded-2xl border border-hairline bg-background px-4 py-3 font-mono text-sm tracking-widest outline-none focus:border-primary"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Start with {formatINR(WELCOME_DEMO)} demo balance — add a friend's code
                and you both get {formatINR(REFERRAL_BONUS)} more.
              </p>
            </div>
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-3 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />

          {mode === "signin" && (
            <button
              type="button"
              onClick={forgotPassword}
              disabled={busy}
              className="mt-3 block w-full text-right text-xs font-medium text-primary disabled:opacity-60"
            >
              Forgot password?
            </button>
          )}

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          {notice && <p className="mt-3 text-xs text-primary">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <button
            type="button"
            onClick={google}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-hairline bg-background px-4 py-3.5 text-sm font-medium"
          >
            Continue with Google
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          {mode === "signin"
            ? "New to CommitX? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
