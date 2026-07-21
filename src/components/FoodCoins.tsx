import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

function CoinIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 64 64" className="h-14 w-14 drop-shadow-[0_4px_12px_rgba(191,149,63,0.25)]">
        <defs>
          <radialGradient id="coinGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#F7E7B4" />
            <stop offset="55%" stopColor="#D9B871" />
            <stop offset="100%" stopColor="#A9873F" />
          </radialGradient>
          <linearGradient id="shine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#coinGrad)" stroke="#8C6E33" strokeWidth="0.8" />
        <circle cx="32" cy="32" r="23" fill="none" stroke="#8C6E33" strokeOpacity="0.35" strokeWidth="0.6" />
        {/* Fork */}
        <g stroke="#6B5122" strokeWidth="1.4" strokeLinecap="round" fill="none">
          <line x1="24" y1="20" x2="24" y2="30" />
          <line x1="21.5" y1="20" x2="21.5" y2="25" />
          <line x1="26.5" y1="20" x2="26.5" y2="25" />
          <line x1="24" y1="30" x2="24" y2="44" />
        </g>
        {/* Spoon */}
        <g stroke="#6B5122" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <ellipse cx="40" cy="24" rx="4" ry="5.5" />
          <line x1="40" y1="29" x2="40" y2="44" />
        </g>
        {/* Shimmer sweep */}
        <rect x="-20" y="0" width="20" height="64" fill="url(#shine)" className="coin-shimmer" />
      </svg>
      <style>{`
        .coin-shimmer {
          transform: translateX(0);
          animation: coin-sweep 4.5s ease-in-out infinite;
        }
        @keyframes coin-sweep {
          0%, 70% { transform: translateX(0); opacity: 0; }
          75% { opacity: 1; }
          100% { transform: translateX(84px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function FoodCoins({
  userCoins,
  milestone = 1000,
  communityCoins,
  hydrated,
}: {
  userCoins: number;
  milestone?: number;
  communityCoins: number;
  hydrated: boolean;
}) {
  const you = useCountUp(userCoins, 1200, hydrated);
  const community = useCountUp(communityCoins, 1600, hydrated);
  const progress = Math.min(100, Math.round((userCoins / milestone) * 100));
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => setBarWidth(progress));
    return () => cancelAnimationFrame(id);
  }, [progress, hydrated]);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              🍽 Food Coins
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">Your Food Coins</p>
            <p className="mt-1 text-3xl font-semibold text-foreground tabular-nums">
              <span className="text-[#B8892F]">🪙</span>{" "}
              {hydrated ? you.toLocaleString() : "0"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Earn 1 Food Coin for every 1 hour completed session.
            </p>
          </div>
          <CoinIcon />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Next Community Milestone
            </p>
            <p className="text-[11px] font-medium text-foreground tabular-nums">{progress}%</p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D9B871] to-[#B8892F] transition-[width] duration-[1400ms] ease-out"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {userCoins.toLocaleString()} / {milestone.toLocaleString()} Food Coins
          </p>
        </div>

        <div className="mt-5 border-t border-hairline pt-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            🌍 Community Food Coins
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
            {hydrated ? community.toLocaleString() : "0"}{" "}
            <span className="text-sm font-normal text-muted-foreground">Coins Earned</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every completed commitment contributes to our community impact.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <p className="text-sm font-semibold text-foreground">Community Impact</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Every hour you stay committed earns 1 Food Coin. As CommitX grows, Food Coins
          will be transformed into real meals funded by CommitX.
        </p>
        <p className="mt-3 text-xs font-medium italic text-foreground">
          Together, we’re turning discipline into impact.
        </p>
      </div>
    </div>
  );
}
