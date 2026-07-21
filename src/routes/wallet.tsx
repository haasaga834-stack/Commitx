import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState } from "@/lib/commitx-store";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "CommitX — Demo Wallet" },
      { name: "description", content: "Track the value you commit and reclaim." },
      { property: "og:title", content: "CommitX — Demo Wallet" },
      { property: "og:description", content: "Track the value you commit and reclaim." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { state, hydrated } = useAppState();
  const txns = state.sessions;

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Demo Wallet
        </p>

        <div className="mt-6 rounded-3xl bg-primary p-8 text-primary-foreground shadow-lift">
          <p className="text-xs uppercase tracking-widest opacity-70">Balance</p>
          <p className="mt-3 font-display text-5xl font-semibold tabular-nums">
            ${hydrated ? state.balance : "—"}
          </p>
          <p className="mt-2 text-xs opacity-70">
            Demo funds only · no real payments
          </p>
        </div>

        <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
          Transactions
        </p>

        {hydrated && txns.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-soft">
            No transactions yet. Complete a commitment to see it here.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {txns.map((s) => {
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
                    </p>
                  </div>
                  <p
                    className={
                      returned
                        ? "text-sm font-medium text-primary"
                        : "text-sm font-medium text-destructive"
                    }
                  >
                    {returned ? "+" : "−"}${s.value}
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
