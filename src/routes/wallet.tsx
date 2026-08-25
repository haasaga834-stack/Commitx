import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import {
  useAppState,
  coinLabel,
  formatCoins,
  COINS_PER_HOUR,
  WELCOME_COINS,
  REFERRAL_REWARD,
  coinsForMinutes,
} from "@/lib/commitx-store";
import { CxCoin } from "@/components/CxCoin";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "CommitX — Cx Coins" },
      {
        name: "description",
        content: "Track your Cx Coins, how you earn them and your commitment history.",
      },
      { property: "og:title", content: "CommitX — Cx Coins" },
      {
        property: "og:description",
        content: "Track your Cx Coins, how you earn them and your commitment history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CxCoinsScreen,
});

function CxCoinsScreen() {
  const { state, hydrated } = useAppState();
  const coins = state.coins;

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">Cx Coins</p>
        <h1 className="mt-2 text-center text-3xl font-semibold">Your Cx Coins</h1>


        {/* Balance */}
        <div className="mt-6 rounded-3xl border border-hairline bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <CxCoin className="h-4 w-4" /> Balance
            </p>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary">
              In-app points
            </span>
          </div>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-foreground">
            {hydrated ? formatCoins(coins) : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Cx Coins are in-app points only. They have no cash value and cannot be
            bought, withdrawn, transferred or exchanged.
          </p>

          <ul className="mt-4 space-y-2 rounded-2xl border border-hairline bg-background px-4 py-3 text-xs text-muted-foreground">
            <li>New account: {coinLabel(WELCOME_COINS)} to get started.</li>
            <li>Every completed study hour: +{coinLabel(COINS_PER_HOUR)}.</li>
            <li>Referral: +{coinLabel(REFERRAL_REWARD)} for you and your friend.</li>
            <li>Minimum to start a commitment: {coinLabel(50)}.</li>
            <li>Cx Coupons are coming soon — save your coins for them.</li>
          </ul>
        </div>

        {/* Activity */}
        <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
          Coin activity
        </p>
        {hydrated && state.sessions.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-soft">
            No activity yet. Complete a commitment to earn your first Cx Coins.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {state.sessions.map((s) => {
              const completed = s.status === "completed";
              const earned = s.coinsEarned ?? coinsForMinutes(s.durationMinutes);
              const spent = s.coinsSpent ?? s.value;
              const amount = completed ? earned : spent;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-soft"
                >
                  <div
                    className={
                      completed
                        ? "flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary"
                        : "flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                    }
                  >
                    {completed ? (
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
                      {completed ? "Earned" : "Forfeited"}
                    </p>
                  </div>
                  <p
                    className={
                      completed
                        ? "text-sm font-medium text-primary tabular-nums"
                        : "text-sm font-medium text-destructive tabular-nums"
                    }
                  >
                    {completed ? "+" : "−"}
                    {formatCoins(amount)}
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
