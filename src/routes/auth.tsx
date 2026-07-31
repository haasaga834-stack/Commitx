import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Hourglass } from "@/components/Hourglass";
import { Loader2 } from "lucide-react";
import { hasNativeGoogleSignIn, nativeGoogleSignIn } from "@/lib/native-auth";

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
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

  async function google() {
    setError(null);
    // Android shell: native Google Sign-In (Credential Manager) — never a browser.
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
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
