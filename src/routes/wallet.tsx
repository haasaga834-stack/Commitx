import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, formatINR } from "@/lib/commitx-store";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "CommitX — Wallet" },
      { name: "description", content: "Track your Demo balance and commitment history." },
      { property: "og:title", content: "CommitX — Wallet" },
      { property: "og:description", content: "Track your Demo balance and commitment history." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { state, hydrated } = useAppState();

  const demo = state.balances.demo;


  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Wallet
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Your demo balance</h1>

        {/* Demo Balance */}
        <div className="mt-6 rounded-3xl border border-hairline bg-card p-6 shadow-soft">
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
            Virtual · non-withdrawable · one-time welcome credit of ₹300.
          </p>
          <p className="mt-4 rounded-2xl border border-hairline bg-background px-4 py-3 text-xs text-muted-foreground">
            Demo money is granted once and cannot be topped up. Complete your commitments to
            keep it.
          </p>

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
                      {" · Demo"}
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

    </MobileShell>
  );
}

