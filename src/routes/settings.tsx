import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useTheme } from "@/lib/theme";
import { useAppState, setState, formatINR, REFERRAL_BONUS } from "@/lib/commitx-store";
import { ACTIVE_VERIFIED_SESSION_KEY } from "@/lib/verified-mode";
import { useState } from "react";
import { ArrowLeft, Moon, Sun, Copy, Check, Trash2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "CommitX — Settings" },
      { name: "description", content: "Appearance, referrals and account controls for CommitX." },
      { property: "og:title", content: "CommitX — Settings" },
      { property: "og:description", content: "Appearance, referrals and account controls for CommitX." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { isDark, setMode } = useTheme();
  const { state, hydrated } = useAppState();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const referralCode =
    "COMMIT-" + (state.profile.name.split(" ")[0] || "YOU").toUpperCase().slice(0, 6);

  function copyReferral() {
    try {
      navigator.clipboard?.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  function deleteAccount() {
    try {
      localStorage.removeItem("commitx-state-v2");
      localStorage.removeItem("commitx-state-v1");
      localStorage.removeItem(ACTIVE_VERIFIED_SESSION_KEY);
    } catch {}
    setState(() => ({
      balances: { real: 0, demo: 0 },
      sessions: [],
      profile: { name: "New User", age: "", sex: "", education: "" },
      referralCredited: false,
    }));
    setConfirming(false);
    setDeleted(true);
  }

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-2xl font-semibold">Settings</h1>
        </div>

        {/* Appearance */}
        <p className="mt-9 text-xs uppercase tracking-widest text-muted-foreground">
          Appearance
        </p>
        <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">Saved on this device</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={isDark}
              aria-label="Toggle dark mode"
              onClick={() => setMode(isDark ? "light" : "dark")}
              className={
                "relative h-7 w-12 rounded-full transition-colors " +
                (isDark ? "bg-primary" : "bg-muted")
              }
            >
              <span
                className={
                  "absolute top-1 h-5 w-5 rounded-full bg-card shadow-soft transition-all " +
                  (isDark ? "left-6" : "left-1")
                }
              />
            </button>
          </div>
        </div>

        {/* Referral */}
        <p className="mt-9 text-xs uppercase tracking-widest text-muted-foreground">
          Referrals
        </p>
        <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-sm font-medium">Invite friends</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When a friend signs up with your code, you receive{" "}
            {formatINR(REFERRAL_BONUS)} demo balance — once per referred friend.
            Demo balance is non-withdrawable and can only be used for commitments.
          </p>
          <button
            onClick={copyReferral}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-dashed border-hairline px-4 py-3"
          >
            <span className="font-mono text-sm text-foreground">
              {hydrated ? referralCode : ""}
            </span>
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Danger zone */}
        <p className="mt-9 text-xs uppercase tracking-widest text-muted-foreground">
          Account
        </p>
        <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10">
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </span>
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Permanently erases your profile, wallet, sessions, streaks, Food
                Coins, referrals and settings. This cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirming(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
            Delete my account
          </button>
          {deleted && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              All data on this device has been deleted.
            </p>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-4xl bg-card p-6 pb-10 shadow-lift">
            <h2 className="font-display text-xl font-semibold">Delete account?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This permanently removes your profile, wallet balances, session
              history, streaks, Food Coins and referral records. It cannot be
              undone.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                className="rounded-2xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
