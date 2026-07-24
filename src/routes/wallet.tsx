import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import {
  useAppState,
  formatINR,
  REFERRAL_BONUS,
} from "@/lib/commitx-store";
import { ArrowDownLeft, ArrowUpRight, Copy, Check, Gift } from "lucide-react";
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
  const [showMoneyNotice, setShowMoneyNotice] = useState(false);
  const [showAddDemo, setShowAddDemo] = useState(false);
  const [demoAmount, setDemoAmount] = useState("100");
  const [copied, setCopied] = useState(false);

  const real = state.balances.real;
  const demo = state.balances.demo;
  const referralCode = "COMMIT-" + (state.profile.name.split(" ")[0] || "YOU").toUpperCase().slice(0, 6);

  function copyReferral() {
    try {
      navigator.clipboard?.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function addDemo(amount: number) {
    if (!amount || amount <= 0) return;
    import("@/lib/commitx-store").then(({ setState }) => {
      setState((s) => ({
        ...s,
        balances: { ...s.balances, demo: s.balances.demo + amount },
      }));
    });
    setShowAddDemo(false);
    setDemoAmount("100");
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
              Coming Soon
            </span>
          </div>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums">
            {hydrated ? formatINR(real) : "—"}
          </p>
          <p className="mt-2 text-xs opacity-70">User-deposited funds · trial access paused</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setShowMoneyNotice(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-primary"
            >
              Deposit
            </button>
            <button
              onClick={() => setShowMoneyNotice(true)}
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white"
            >
              Withdraw
            </button>
          </div>
        </div>

        <ComingSoonCard className="mt-3" />

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
          <button
            onClick={() => setShowAddDemo(true)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
          >
            Add demo money
          </button>
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

      {showMoneyNotice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
            <ComingSoonCard />
            <button
              onClick={() => setShowMoneyNotice(false)}
              className="mt-5 w-full rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background"
            >
              Continue with Demo Balance
            </button>
          </div>
        </div>
      )}

      {showAddDemo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Add demo money</p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">Top up your demo balance</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Virtual balance for practice sessions. Not withdrawable.
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-hairline bg-background px-4 py-3">
              <span className="text-lg font-semibold text-foreground">₹</span>
              <input
                type="number"
                inputMode="numeric"
                value={demoAmount}
                onChange={(e) => setDemoAmount(e.target.value)}
                className="flex-1 bg-transparent text-lg font-semibold text-foreground outline-none"
                placeholder="Amount"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[100, 250, 500, 1000].map((n) => (
                <button
                  key={n}
                  onClick={() => setDemoAmount(String(n))}
                  className="rounded-full border border-hairline bg-background px-4 py-1.5 text-xs font-medium text-foreground"
                >
                  +{formatINR(n)}
                </button>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowAddDemo(false)}
                className="flex-1 rounded-full border border-hairline bg-background px-5 py-3 text-sm font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => addDemo(parseInt(demoAmount, 10) || 0)}
                className="flex-1 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background"
              >
                Add {formatINR(parseInt(demoAmount, 10) || 0)}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}

function ComingSoonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-info/20 bg-info/8 p-4 text-center shadow-soft ${className}`}>
      <p className="text-sm font-medium text-info">
        Real money deposits coming soon
      </p>
    </div>
  );
}
