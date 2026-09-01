import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "@/components/Hourglass";
import { Check, Flame, Clock, Target } from "lucide-react";
import { CxCoin } from "@/components/CxCoin";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useAppState, stats, coinLabel, coinsForMinutes } from "@/lib/commitx-store";
import { useAuth } from "@/lib/use-auth";

const search = z.object({
  goal: z.string().default("Focus"),
  duration: z.coerce.number().default(0),
  value: z.coerce.number().default(0),
});

export const Route = createFileRoute("/success")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "CommitX — Commitment complete" },
      { name: "description", content: "You kept your promise." },
      { property: "og:title", content: "CommitX — Commitment complete" },
      { property: "og:description", content: "You kept your promise." },
    ],
  }),
  component: Success,
});

/** Smooth count-up used by the completion stats. */
function useCountUp(target: number, duration = 900, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / duration);
        setValue(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}

function Success() {
  const { goal, duration, value } = Route.useSearch();
  const { state } = useAppState();
  const s = stats(state.sessions);
  const { user, loading: authLoading } = useAuth();
  const guest = !authLoading && !user;

  const coinsEarned = coinsForMinutes(duration);
  const coins = Math.round(useCountUp(s.coinsEarned, 1100, 500));
  const streakValue = Math.round(useCountUp(s.streak, 800, 380));
  const focusMinutes = Math.round(useCountUp(s.totalMinutes, 1000, 460));
  const successRate = Math.round(useCountUp(s.successRate, 1000, 540));

  const focusHours =
    focusMinutes >= 60
      ? `${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m`
      : `${focusMinutes}m`;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 py-14">
      {/* Warm glow + rising embers celebration */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-3xl" />
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-1/3 h-1.5 w-1.5 rounded-full bg-accent/70 animate-ember-float"
            style={{
              left: `${8 + i * 9}%`,
              // @ts-expect-error custom property
              "--ember-x": `${(i % 2 === 0 ? 1 : -1) * (10 + i * 3)}px`,
              animationDelay: `${i * 260}ms`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center">
        <span className="absolute inset-0 m-auto h-40 w-40 rounded-full border border-accent/50 animate-ring-burst" />
        <span
          className="absolute inset-0 m-auto h-40 w-40 rounded-full border border-primary/40 animate-ring-burst"
          style={{ animationDelay: "600ms" }}
        />
        <Hourglass size={200} state="success" progress={1} />
      </div>

      <div className="relative mt-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lift animate-pop-in">
        <Check className="h-7 w-7" strokeWidth={2.6} />
      </div>

      <h1 className="mt-6 text-center font-display text-3xl font-semibold animate-pop-in" style={{ animationDelay: "120ms" }}>
        Commitment complete
      </h1>
      <p
        className="mt-1 text-center text-sm text-muted-foreground animate-fade-up"
        style={{ animationDelay: "200ms" }}
      >
        {goal}
      </p>

      {coinsEarned > 0 && (
        <div
          className="relative mt-6 flex items-center gap-3 overflow-hidden rounded-full border border-accent/40 bg-card px-5 py-3 shadow-soft animate-coin-rise"
          style={{ animationDelay: "320ms" }}
        >
          <span className="text-xl">🪙</span>
          <p className="text-sm font-medium text-foreground">
            +{coinLabel(coinsEarned)} earned
          </p>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-shimmer-sweep"
          />
        </div>
      )}

      <div
        className="mt-7 grid w-full max-w-md grid-cols-2 gap-3 animate-fade-up sm:grid-cols-4"
        style={{ animationDelay: "380ms" }}
      >
        <StatTile
          icon={<Flame className="h-4 w-4" />}
          label="Streak"
          value={`${streakValue}d`}
          highlight
        />
        <StatTile icon={<Clock className="h-4 w-4" />} label="Focus total" value={focusHours} />
        <StatTile icon={<CxCoin className="h-4 w-4" />} label="Cx Coins" value={String(coins)} />
        <StatTile icon={<Target className="h-4 w-4" />} label="Success" value={`${successRate}%`} />
      </div>

      <div
        className="mt-4 w-full max-w-md space-y-2 animate-fade-up"
        style={{ animationDelay: "460ms" }}
      >
        <Row label="Duration" value={`${duration} min`} />
        <Row label="Commitment returned" value={coinLabel(value)} />
      </div>

      {guest ? (
        <div
          className="mt-6 w-full max-w-md rounded-3xl border border-hairline bg-card p-5 text-center shadow-soft animate-fade-up"
          style={{ animationDelay: "500ms" }}
        >
          <h2 className="font-display text-lg font-semibold">
            Keep your progress with CommitX
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account or sign in to save this session and track your progress.
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground"
          >
            Continue with Google or Email
          </Link>
        </div>
      ) : null}


      <Link
        to="/"
        replace
        className="mt-8 inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98] animate-fade-up"
        style={{ animationDelay: "540ms" }}
      >
        Done
      </Link>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-card p-3 text-center shadow-soft ${
        highlight ? "ring-1 ring-accent/40 animate-streak-pulse" : ""
      }`}
    >
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-primary">
        {icon}
      </span>
      <p className="mt-2 text-base font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-soft">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
