import { createFileRoute, Link, useLocation, useRouter } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { NotificationsCard } from "@/components/NotificationsCard";
import { ReviewModeration } from "@/components/ReviewModeration";
import { CxCoin } from "@/components/CxCoin";
import { useTheme } from "@/lib/theme";
import { coinLabel, REFERRAL_REWARD } from "@/lib/commitx-store";
import { ACTIVE_VERIFIED_SESSION_KEY } from "@/lib/verified-mode";
import { supabase } from "@/integrations/supabase/client";
import { claimReferral, deleteAccount as deleteAccountFn } from "@/lib/account.functions";
import { getDeviceHash } from "@/lib/device";
import { signOutEverywhere } from "@/lib/use-auth";
import { useEffect, useState } from "react";
import { ArrowLeft, Moon, Sun, Copy, Check, Trash2, ShieldAlert, LogOut, BookOpen, ChevronRight, Star, Info, Mail, Smartphone } from "lucide-react";
import { isNativeApp, rateApp } from "@/lib/native-notifications";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "CommitX — Settings" },
      { name: "description", content: "Appearance, referrals and account controls for CommitX." },
      { property: "og:title", content: "CommitX — Settings" },
      { property: "og:description", content: "Appearance, referrals and account controls for CommitX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CommitX — Settings" },
      { name: "twitter:description", content: "Appearance, referrals and account controls for CommitX." },
    ],
  }),
  component: Settings,
});

/** Scroll a Settings section into the middle of the screen and glow it briefly. */
function revealSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("cx-attention");
  // restart the animation reliably
  void el.offsetWidth;
  el.classList.add("cx-attention");
  window.setTimeout(() => el.classList.remove("cx-attention"), 3200);
}

const TILE = "flex items-center gap-2.5 rounded-2xl bg-card p-3 text-left shadow-soft";
const TILE_ICON = "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary";
const TILE_LABEL = "min-w-0 text-xs font-medium leading-tight text-foreground";
const ROW = "flex items-center gap-3 px-3 py-3";
const ROW_ICON = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary";
const SECTION = "text-[10px] uppercase tracking-[0.2em] text-muted-foreground";

function Settings() {
  const router = useRouter();
  const hash = useLocation({ select: (l) => l.hash });
  const { isDark, setMode } = useTheme();
  const [native, setNative] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [alreadyReferred, setAlreadyReferred] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  // Home → Settings → Notifications (or Screen time) deep links.
  useEffect(() => {
    const target = hash.replace(/^#/, "");
    if (target !== "notifications" && target !== "screen-time") return;
    const id = window.setTimeout(() => revealSection(target), 220);
    return () => window.clearTimeout(id);
  }, [hash]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Local session read — no network round trip on every Settings mount.
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("referral_code, referred_by")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !data) return;
      setReferralCode(data.referral_code);
      setAlreadyReferred(Boolean(data.referred_by));
    })();
    return () => {
      active = false;
    };
  }, []);

  function copyReferral() {
    try {
      navigator.clipboard?.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  async function submitCode() {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await claimReferral({
        data: { code: codeInput, deviceHash: getDeviceHash() },
      });
      setClaimMsg(res.message);
      if (res.ok) {
        setAlreadyReferred(true);
        setCodeInput("");
      }
    } catch {
      setClaimMsg("Could not apply that code. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await deleteAccountFn();
      try {
        localStorage.removeItem("commitx-state-v2");
        localStorage.removeItem("commitx-state-v1");
        localStorage.removeItem(ACTIVE_VERIFIED_SESSION_KEY);
      } catch {}
      await signOutEverywhere();
      setConfirming(false);
      router.navigate({ to: "/auth" });
    } catch {
      setDeleting(false);
    }
  }

  return (
    <MobileShell>
      <div className="px-5 pt-8">
        <div className="flex items-center gap-2.5">
          <Link
            to="/profile"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-xl font-semibold">Settings</h1>
        </div>

        {/* Quick actions — four slim tiles */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/how-it-works" className={TILE}>
            <span className={TILE_ICON}>
              <BookOpen className="h-4 w-4" />
            </span>
            <span className={TILE_LABEL}>How CommitX works</span>
          </Link>
          <button onClick={rateApp} className={TILE}>
            <span className={TILE_ICON}>
              <Star className="h-4 w-4" />
            </span>
            <span className={TILE_LABEL}>Rate CommitX</span>
          </button>
          <Link to="/about" className={TILE}>
            <span className={TILE_ICON}>
              <Info className="h-4 w-4" />
            </span>
            <span className={TILE_LABEL}>About us</span>
          </Link>
          <Link to="/wallet" className={TILE}>
            <span className={TILE_ICON}>
              <CxCoin className="h-4 w-4" />
            </span>
            <span className={TILE_LABEL}>Cx Coins</span>
          </Link>
        </div>

        {/* Appearance */}
        <p className={SECTION + " mt-6"}>Appearance</p>
        <div className="mt-2 overflow-hidden rounded-3xl bg-card shadow-soft">
          <div className={ROW + " justify-between"}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={ROW_ICON}>
                {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
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
                "relative h-7 w-12 shrink-0 rounded-full transition-colors " +
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

          {!native && (
            <Link to="/contact" className={ROW + " border-t border-hairline"}>
              <span className={ROW_ICON + " text-primary"}>
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                Contact us
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )}
        </div>

        {/* Notifications & screen time */}
        <p className={SECTION + " mt-6"}>Notifications</p>
        <div className="mt-2 overflow-hidden rounded-3xl bg-card shadow-soft">
          <NotificationsCard />
          {native && (
            <Link
              id="screen-time"
              to="/screen-time"
              className={ROW + " border-t border-hairline"}
            >
              <span className={ROW_ICON}>
                <Smartphone className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">Screen Time</span>
                <span className="block text-xs text-muted-foreground">Today, this week and every app</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )}
        </div>

        {/* Referral */}
        <p className={SECTION + " mt-6"}>Referrals</p>
        <div className="mt-2 rounded-3xl bg-card p-4 shadow-soft">
          <p className="text-sm font-medium">Invite friends</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When a friend signs up with your code, you receive{" "}
            {coinLabel(REFERRAL_REWARD)} — once per referred friend.
            Cx Coins are in-app points and can only be used for commitments.
          </p>
          <button
            onClick={copyReferral}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-hairline px-3.5 py-2.5"
          >
            <span className="font-mono text-sm text-foreground">{referralCode || "…"}</span>
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {!alreadyReferred ? (
            <div className="mt-4 border-t border-hairline pt-4">
              <p className="text-sm font-medium">Have a referral code?</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="CX123ABC"
                  className="min-w-0 flex-1 rounded-xl border border-hairline bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={submitCode}
                  disabled={claiming || !codeInput}
                  className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              {claimMsg && <p className="mt-2 text-xs text-muted-foreground">{claimMsg}</p>}
            </div>
          ) : (
            <p className="mt-4 border-t border-hairline pt-4 text-xs text-muted-foreground">
              A referral code has already been applied to this account.
            </p>
          )}
        </div>

        {/* Danger zone */}
        <p className={SECTION + " mt-6"}>Account</p>
        <div className="mt-2 rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Delete account</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Permanently erases your profile, wallet, sessions, streaks, Cx
                Coins, referrals and settings. This cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
            Delete my account
          </button>
          <button
            onClick={async () => {
              await signOutEverywhere();
              router.navigate({ to: "/auth" });
            }}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

        <div className="h-4" />
      </div>

      <ReviewModeration />

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-4xl bg-card p-5 pb-8 shadow-lift">
            <h2 className="font-display text-lg font-semibold">Delete account?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This permanently removes your profile, Cx Coins, session
              history, streaks, Cx Coins and referral records. It cannot be
              undone.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-2xl bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="rounded-2xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
