import { HeartHandshake } from "lucide-react";

/**
 * Premium informational card explaining how Food Coins work.
 * Purely presentational — subtle shimmer + float animations, CommitX theme tokens.
 */
export function FoodCoinInfoCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-hairline bg-card p-6 shadow-soft ${className}`}
    >
      {/* soft ambient glow */}
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-[#D9B871]/20 blur-3xl" />

      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 animate-gentle-float items-center justify-center rounded-2xl bg-accent/12 text-primary">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Food Coins
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            💚 Earn 1 Food Coin for every successful study hour.
          </p>
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-background/70 px-4 py-3">
        <span className="fc-shimmer inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#F7E7B4] to-[#B8892F] text-sm shadow-soft">
          🪙
        </span>
        <p className="text-sm font-medium text-foreground">
          1 Food Coin = <span className="tabular-nums">₹2</span> donation value
        </p>
      </div>

      <ul className="relative mt-4 space-y-2.5">
        <Line>
          Save your Food Coins and use them to unlock donations from your failed commitments.
        </Line>
        <Line>Every completed session brings someone one step closer to a meal.</Line>
      </ul>

      <p className="relative mt-5 border-t border-hairline pt-4 text-xs font-medium italic text-primary">
        Turning discipline into impact.
      </p>

      <style>{`
        .fc-shimmer { position: relative; overflow: hidden; }
        .fc-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.65) 50%, transparent 65%);
          transform: translateX(-120%);
          animation: fc-sweep 5s ease-in-out infinite;
        }
        @keyframes fc-sweep {
          0%, 72% { transform: translateX(-120%); }
          88%, 100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
