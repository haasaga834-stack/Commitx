import { track } from "@/lib/analytics";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hourglass } from "@/components/Hourglass";
import { Loader2 } from "lucide-react";

import { lovable } from "@/integrations/lovable/index";
import { setPendingReferral } from "@/lib/pending-referral";
import { WELCOME_COINS, REFERRAL_REWARD, coinLabel } from "@/lib/commitx-store";
import { actionErrorMessage, isOnline, OFFLINE_ACTION_MESSAGE } from "@/lib/connectivity";
import { isAndroidSignIn, hasNativeGoogleSignIn, nativeGoogleSignIn } from "@/lib/native-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "CommitX — Sign in" },
      { name: "description", content: "Sign in to CommitX and keep one promise at a time." },
      { property: "og:title", content: "CommitX — Sign in" },
      { property: "og:description", content: "Sign in to CommitX and keep one promise at a time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
    if (!isOnline()) {
      setNotice(null);
      setError(OFFLINE_ACTION_MESSAGE);
      return;
    }
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
        track("signup_completed", { method: "email", confirmed: Boolean(data.session) });
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
      setError(actionErrorMessage(err, err instanceof Error ? err.message : "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError(null);
    setNotice(null);
    if (!isOnline()) {
      setError(OFFLINE_ACTION_MESSAGE);
      return;
    }
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
        actionErrorMessage(
          err,
          err instanceof Error
            ? err.message
            : "Could not send the reset email. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError(null);
    setNotice(null);
    if (!isOnline()) {
      setError(OFFLINE_ACTION_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      if (isAndroidSignIn()) {
        // Discard the legacy detour even for phones that already stored it.
        try { localStorage.removeItem("commitx-google-native-skip"); } catch {}
        if (!hasNativeGoogleSignIn()) {
          throw new Error("In-app Google sign-in isn't available in this version. Update CommitX or sign in with email.");
        }
        await nativeGoogleSignIn();
        router.navigate({ to: "/" });
        return;
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      router.navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // Backing out of the Google account chooser is not a failure.
      if (/cancel/i.test(message)) return;
      const nativeFailure = /^(native_timeout|native_unavailable|token_parse_failed|GetCredential)/.test(message);
      setError(nativeFailure
        ? "Google couldn't finish signing you in. Try again in CommitX, or sign in with email."
        : actionErrorMessage(err, message || "Google sign-in failed."));
    } finally {
      setBusy(false);
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
                Start with {coinLabel(WELCOME_COINS)} — add a friend's code and you
                both get {coinLabel(REFERRAL_REWARD)} more.
              </p>
            </div>
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="Email"
            className="w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
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

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <button
            type="button"
            onClick={googleSignIn}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-hairline bg-background px-4 py-3.5 text-sm font-medium text-foreground disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
            </svg>
            Continue with Google
          </button>
        </form>


        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
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
