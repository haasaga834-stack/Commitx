import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAppState,
  formatINR,
  planDeduction,
  MIN_COMMIT,
  MAX_COMMIT,
} from "@/lib/commitx-store";

export const Route = createFileRoute("/commit")({
  head: () => ({
    meta: [
      { title: "CommitX — New Commitment" },
      { name: "description", content: "Set your goal, duration, value and mode." },
      { property: "og:title", content: "CommitX — New Commitment" },
      { property: "og:description", content: "Set your goal, duration, value and mode." },
    ],
  }),
  component: Commit,
});

const GOALS = ["Study", "Reading", "Work", "Fitness", "Meditation", "Custom"];

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Commit() {
  const navigate = useNavigate();
  const { state, hydrated } = useAppState();
  const [goal, setGoal] = useState("Study");
  const [customGoal, setCustomGoal] = useState("");
  const [duration, setDuration] = useState(30);
  const [value, setValue] = useState(MIN_COMMIT);
  const [mode, setMode] = useState<"standard" | "verified">("standard");
  const [confirmVerified, setConfirmVerified] = useState(false);
  const [preferReal, setPreferReal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalGoal = goal === "Custom" ? customGoal.trim() || "Custom" : goal;

  const plan = useMemo(
    () => planDeduction(value, state.balances, preferReal),
    [value, state.balances, preferReal],
  );

  function begin() {
    if (value < MIN_COMMIT || value > MAX_COMMIT) {
      setError(`Commitment must be between ${formatINR(MIN_COMMIT)} and ${formatINR(MAX_COMMIT)}.`);
      return;
    }
    if (!plan.ok) {
      setError("Insufficient Demo Balance. Real money deposits are coming soon during the trial phase.");
      return;
    }
    setError(null);
    if (mode === "verified" && !confirmVerified) {
      setConfirmVerified(true);
      return;
    }
    const params = new URLSearchParams({
      goal: finalGoal,
      duration: String(duration),
      value: String(value),
      mode,
      preferReal: preferReal ? "1" : "0",
    });
    navigate({ to: "/session", search: Object.fromEntries(params) as Record<string, string> });
  }

  function clampValue(next: number) {
    const n = Math.round(next);
    if (Number.isNaN(n)) return;
    setValue(Math.min(MAX_COMMIT, Math.max(MIN_COMMIT, n)));
    setError(null);
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-md px-6 pt-14 md:max-w-2xl md:px-10 md:pt-20">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            New commitment
          </p>
          <div className="w-10" />
        </div>

        <h1 className="mt-8 text-3xl font-semibold">Make a promise.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your terms — you'll keep them.
        </p>

        {/* Goal */}
        <section className="mt-8">
          <Label>Goal</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-all",
                  goal === g
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-hairline bg-card text-foreground hover:border-muted-foreground/40",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          {goal === "Custom" && (
            <input
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="Name your focus"
              className="mt-3 w-full rounded-2xl border border-hairline bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          )}
        </section>

        {/* Duration */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <Label>Duration</Label>
            <span className="font-display text-2xl font-semibold text-primary">
              {fmtDuration(duration)}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={360}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-4 w-full accent-[color:var(--color-primary)]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>10 min</span>
            <span>6 h</span>
          </div>
          {duration > 120 && (
            <p className="mt-3 rounded-2xl bg-accent/10 px-4 py-3 text-xs text-primary">
              You'll receive one complimentary 10 minute break reminder.
            </p>
          )}
        </section>

        {/* Value */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <Label>Commitment value</Label>
            <span className="text-[11px] text-muted-foreground">
              {formatINR(MIN_COMMIT)} – {formatINR(MAX_COMMIT)}
            </span>
          </div>
          <div className="mt-3 flex items-center rounded-2xl border border-hairline bg-card px-4 py-3">
            <span className="text-muted-foreground">₹</span>
            <input
              type="number"
              min={MIN_COMMIT}
              max={MAX_COMMIT}
              value={value}
              onChange={(e) => clampValue(Number(e.target.value) || 0)}
              className="ml-2 w-full bg-transparent text-lg font-medium outline-none"
            />
          </div>
          <input
            type="range"
            min={MIN_COMMIT}
            max={MAX_COMMIT}
            step={10}
            value={value}
            onChange={(e) => clampValue(Number(e.target.value))}
            className="mt-4 w-full accent-[color:var(--color-primary)]"
          />

          {/* Deduction preview */}
          <div className="mt-4 rounded-2xl bg-card px-4 py-3 shadow-soft">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Available</span>
              <span className="tabular-nums">
                Demo {formatINR(state.balances.demo)} · Real {formatINR(state.balances.real)}
              </span>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={preferReal}
                onChange={(e) => setPreferReal(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-primary)]"
              />
              Use Real Balance first
            </label>
            {hydrated && plan.ok && (
              <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                Will deduct: Demo {formatINR(plan.demoUsed)} + Real {formatINR(plan.realUsed)}
              </p>
            )}
          </div>
          {error && (
            <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </section>

        {/* Mode */}
        <section className="mt-8">
          <Label>Mode</Label>
          <div className="mt-3 space-y-3">
            <ModeCard
              title="Standard"
              subtitle="Flexible focus"
              points={[
                "App switching allowed with a warning",
                "Incoming calls allowed",
                "Timer continues in background",
              ]}
              selected={mode === "standard"}
              onClick={() => {
                setMode("standard");
                setConfirmVerified(false);
              }}
            />
            <ModeCard
              title="Verified"
              subtitle="Strict accountability"
              points={[
                "Home, Recents, or app switch fails",
                "Calls, screen lock, and notification shade allowed",
                "Split-screen fails on Android",
              ]}
              selected={mode === "verified"}
              onClick={() => {
                setMode("verified");
                setConfirmVerified(false);
              }}
            />
          </div>
          {mode === "verified" && confirmVerified && (
            <p className="mt-4 rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-foreground">
              Leaving this session before completion will fail your commitment.
              Tap Commit Now again to accept.
            </p>
          )}
        </section>

        <button
          onClick={begin}
          className="mt-10 block w-full rounded-full bg-primary px-8 py-5 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
        >
          {mode === "verified" && !confirmVerified ? "Continue" : "Commit Now"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function ModeCard({
  title,
  subtitle,
  points,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  points: string[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border p-5 text-left transition-all",
        selected
          ? "border-primary bg-card shadow-lift"
          : "border-hairline bg-card shadow-soft",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-lg font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-hairline",
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground/60" />
            {p}
          </li>
        ))}
      </ul>
    </button>
  );
}
