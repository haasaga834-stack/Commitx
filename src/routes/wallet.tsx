import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import {
  useAppState,
  setState,
  formatINR,
  MIN_DEPOSIT,
  MAX_REAL_WALLET,
  REFERRAL_BONUS,
} from "@/lib/commitx-store";
import { ArrowDownLeft, ArrowUpRight, Plus, Copy, Check, Gift } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "CommitX — Wallet" },
      { name: "description", content: "Track your Real and Demo balances." },
      { property: "og:title", content: "CommitX — Wallet" },
      { property: "og:description", content: "Track your Real and Demo balances." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { state, hydrated } = useAppState();
  const [showDeposit, setShowDeposit] = useState(false);
  const [amount, setAmount] = useState<string>("100");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const real = state.balances.real;
  const demo = state.balances.demo;
  const referralCode = "COMMIT-" + (state.profile.name.split(" ")[0] || "YOU").toUpperCase().slice(0, 6);

  function submitDeposit() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n)) return setError("Enter a valid amount.");
    if (n < MIN_DEPOSIT) return setError(`Minimum deposit is ${formatINR(MIN_DEPOSIT)}.`);
    if (real + n > MAX_REAL_WALLET)
      return setError(`Real balance cannot exceed ${formatINR(MAX_REAL_WALLET)}.`);
    setState((s) => ({ ...s, balances: { ...s.balances, real: s.balances.real + n } }));
    setShowDeposit(false);
    setAmount("100");
    setError(null);
  }

  function copyReferral() {
    try {
      navigator.clipboard?.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Wallet
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Your balances</h1>

        {/* Real Balance */}
        <div className="mt-6 rounded-3xl bg-primary p-6 text-primary-foreground shadow-lift">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest opacity-80">💰 Real Balance</p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] uppercase tracking-wider">
              Withdrawable
            </span>
          </div>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums">
            {hydrated ? formatINR(real) : "—"}
          </p>
          <p className="mt-2 text-xs opacity-70">User-deposited funds</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setShowDeposit(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Deposit
            </button>
            <button
              disabled={real === 0}
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Demo Balance */}
        <div className="mt-3 rounded-3xl border border-hairline bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              🎁 Demo Balance
            </p>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary">
              Session Use Only
            </span>
          </div>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-foreground">
            {hydrated ? formatINR(demo) : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Virtual · non-withdrawable · from bonuses and rewards.
          </p>
        </div>

        {/* Referral */}
        <div className="mt-3 rounded-3xl bg-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Refer & earn</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Every referred friend gets {formatINR(REFERRAL_BONUS)} demo balance on sign-up.
              </p>
            </div>
          </div>
          <button
            onClick={copyReferral}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-dashed border-hairline bg-background px-4 py-3"
          >
            <span className="font-mono text-sm text-foreground">{referralCode}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        </div>

        {/* Transactions */}
        <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
          Transactions
        </p>
        {hydrated && state.sessions.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-soft">
            No transactions yet. Complete a commitment to see it here.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {state.sessions.map((s) => {
              const returned = s.status === "completed";
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-soft"
                >
                  <div
                    className={
                      returned
                        ? "flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary"
                        : "flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                    }
                  >
                    {returned ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.goal}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {returned ? "Returned" : "Deducted"}
                      {s.demoUsed && s.realUsed
                        ? " · Demo + Real"
                        : s.realUsed
                          ? " · Real"
                          : " · Demo"}
                    </p>
                  </div>
                  <p
                    className={
                      returned
                        ? "text-sm font-medium text-primary tabular-nums"
                        : "text-sm font-medium text-destructive tabular-nums"
                    }
                  >
                    {returned ? "+" : "−"}
                    {formatINR(s.value)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
            <p className="font-display text-xl font-semibold">Add to Real Balance</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Min {formatINR(MIN_DEPOSIT)} · Wallet cap {formatINR(MAX_REAL_WALLET)}.
            </p>
            <div className="mt-5 flex items-center rounded-2xl border border-hairline bg-background px-4 py-3">
              <span className="text-muted-foreground">₹</span>
              <input
                type="number"
                min={MIN_DEPOSIT}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="ml-2 w-full bg-transparent text-lg font-medium outline-none"
              />
            </div>
            <div className="mt-3 flex gap-2">
              {[50, 100, 250, 500].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setAmount(String(q));
                    setError(null);
                  }}
                  className="flex-1 rounded-full border border-hairline bg-background px-3 py-2 text-xs font-medium"
                >
                  {formatINR(q)}
                </button>
              ))}
            </div>
            {error && (
              <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowDeposit(false);
                  setError(null);
                }}
                className="flex-1 rounded-full border border-hairline bg-background px-5 py-3 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={submitDeposit}
                className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
