import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimReferral } from "@/lib/account.functions";
import { getDeviceHash } from "@/lib/device";
import { formatCoins } from "@/lib/commitx-store";
import { referralLink, referralShareMessage } from "@/lib/referral-link";
import { shareInvite } from "@/lib/share-invite";

type HistoryRow = { id: string; direction: string; friend_name: string; coins: number; created_at: string };
const NEW_ACCOUNT_MS = 72 * 3600 * 1000;

/** Settings → Invite a Friend. Rewards and validation live in the database. */
export function ReferralCard() {
  const [code, setCode] = useState("");
  const [alreadyReferred, setAlreadyReferred] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) return;
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("referral_code, referred_by, created_at").eq("id", user.id).maybeSingle(),
      supabase.rpc("my_referral_history"),
    ]);
    if (p) {
      setCode(p.referral_code);
      setAlreadyReferred(Boolean(p.referred_by));
      setIsNewAccount(Date.now() - new Date(p.created_at).getTime() < NEW_ACCOUNT_MS);
    }
    if (Array.isArray(h)) setHistory(h as HistoryRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = code ? referralLink(code) : "";
  const invited = history.filter((r) => r.direction === "referred_friend");
  const earned = history.reduce((sum, r) => sum + (r.coins || 0), 0);

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setNotice(`Copy this: ${text}`);
    }
  }

  async function share() {
    if (!link) return;
    const native = (window as unknown as { CommitXAndroid?: { shareText?: (t: string, m: string) => void } }).CommitXAndroid;
    const code = link.slice(link.lastIndexOf("/") + 1);
    const message = referralShareMessage(decodeURIComponent(code));
    const res = await shareInvite("Invite a friend to CommitX", message, "", {
      nativeShare: native?.shareText ? (t) => native.shareText?.(t, message) : undefined,
      webShare: !native && navigator.share ? () => navigator.share({ title: "Join CommitX", text: message }) : undefined,
      copy: navigator.clipboard?.writeText ? () => navigator.clipboard.writeText(message) : undefined,
    });
    if (res === "copied" && !native) {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      setNotice("Opened WhatsApp — invite also copied.");
    } else if (res === "unavailable") setNotice(`Share this link: ${link}`);
    else setNotice(null);
  }

  async function submitCode() {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await claimReferral({ data: { code: codeInput, deviceHash: getDeviceHash() } });
      setClaimMsg(res.message);
      if (res.ok) {
        setAlreadyReferred(true);
        setCodeInput("");
        void load();
      }
    } catch {
      setClaimMsg("Could not apply that code. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mt-2 rounded-3xl bg-card p-4 shadow-soft">
      <p className="text-sm font-medium">Invite a Friend</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Invite your friends to CommitX! They receive 100 bonus CX Coins, and you earn 50 CX Coins for
        every successful referral.
      </p>

      <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">Your code</p>
      <button
        onClick={() => code && copy(code, "code")}
        aria-label="Copy referral code"
        className="mt-1 flex w-full items-center justify-between rounded-2xl border border-dashed border-hairline px-3.5 py-2.5"
      >
        <span className="font-mono text-sm text-foreground">{code || "…"}</span>
        {copied === "code" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
      </button>

      <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">Your link</p>
      <button
        onClick={() => link && copy(link, "link")}
        aria-label="Copy referral link"
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-hairline px-3.5 py-2.5"
      >
        <span className="truncate text-xs text-foreground">{link || "…"}</span>
        {copied === "link" ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      <button
        onClick={share}
        disabled={!link}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        <Share2 className="h-4 w-4" /> Share Invite Link
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => code && copy(code, "code")} className="rounded-xl border border-hairline px-3 py-2 text-xs">
          {copied === "code" ? "Code copied" : "Copy Referral Code"}
        </button>
        <button onClick={() => link && copy(link, "link")} className="rounded-xl border border-hairline px-3 py-2 text-xs">
          {copied === "link" ? "Link copied" : "Copy Referral Link"}
        </button>
      </div>
      {notice && <p className="mt-2 text-xs text-muted-foreground">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-background px-3 py-2.5">
          <p className="text-lg font-semibold tabular-nums">{invited.length}</p>
          <p className="text-[11px] text-muted-foreground">Successful referrals</p>
        </div>
        <div className="rounded-2xl bg-background px-3 py-2.5">
          <p className="text-lg font-semibold tabular-nums">{formatCoins(earned)}</p>
          <p className="text-[11px] text-muted-foreground">CX Coins from referrals</p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Referral history</p>
          {history.map((r) => (
            <div key={r.id + r.direction} className="flex items-center justify-between rounded-xl bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {r.direction === "referred_friend" ? `${r.friend_name} joined` : `Joined with ${r.friend_name}'s code`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  {" · Credited"}
                </p>
              </div>
              <p className="text-xs font-medium tabular-nums text-primary">+{formatCoins(r.coins)}</p>
            </div>
          ))}
        </div>
      )}

      {alreadyReferred ? (
        <p className="mt-4 border-t border-hairline pt-4 text-xs text-muted-foreground">
          A referral code has already been applied to this account.
        </p>
      ) : isNewAccount ? (
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
      ) : null}
    </div>
  );
}
