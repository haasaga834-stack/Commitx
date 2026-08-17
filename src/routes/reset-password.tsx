import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Hourglass } from "@/components/Hourglass";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CommitX — Reset password" },
      {
        name: "description",
        content: "Choose a new password for your CommitX account.",
      },
      { property: "og:title", content: "CommitX — Reset password" },
      {
        property: "og:description",
        content: "Choose a new password for your CommitX account.",
      },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase delivers a recovery session from the emailed link.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.navigate({ to: "/" }), 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the password. Request a new reset link.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-14">
        <div className="flex flex-col items-center">
          <Hourglass size={110} state="idle" />
          <h1 className="mt-6 font-display text-2xl font-semibold">
            Set a new password
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Choose a password you'll remember — you'll stay signed in afterwards.
          </p>
        </div>

        {done ? (
          <div className="mt-10 rounded-3xl bg-card p-6 text-center shadow-soft">
            <p className="text-sm font-medium text-primary">
              Password updated. Taking you back to CommitX…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 rounded-3xl bg-card p-6 shadow-soft">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="mt-3 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />

            {!ready && (
              <p className="mt-3 text-xs text-muted-foreground">
                Open this page from the reset link in your email to continue.
              </p>
            )}
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={busy || !ready}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
