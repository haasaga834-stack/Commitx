import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { DurationWheel } from "@/components/DurationWheel";
import { ThemePicker } from "@/components/ThemePicker";
import { formatDuration } from "@/lib/planner";
import { clearEndedSession, writeActiveVerifiedSession } from "@/lib/verified-mode";
import { clearShieldPlan } from "@/lib/focus-shield";
import type { SessionThemeId } from "@/lib/session-themes";
import { useAuth } from "@/lib/use-auth";
import { useAppState, coinLabel, coinsForMinutes, MIN_COMMIT, MAX_COMMIT } from "@/lib/commitx-store";
import { claimActiveDbSession } from "@/lib/active-session";
import { actionErrorMessage } from "@/lib/connectivity";

type Mode = "standard" | "verified";

const GOALS = [
  { emoji: "📚", label: "Study" },
  { emoji: "📖", label: "Read" },
  { emoji: "💼", label: "Work" },
  { emoji: "🧘", label: "Meditation" },
  { emoji: "✨", label: "Custom" },
] as const;

/**
 * Compact setup sequence for visitors who continue from the Standard/Verified
 * popup: goal → duration → existing theme picker → the existing session page.
 * No account, no Cx Coins staked (value 0) and nothing stored server-side.
 */
export function GuestSetup({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"goal" | "duration" | "theme">("goal");
  const [goal, setGoal] = useState<string>("Study");
  const [customGoal, setCustomGoal] = useState("");
  const [duration, setDuration] = useState(60);
  const startedRef = useRef(false);
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const { state } = useAppState();
  const [stake, setStake] = useState(MIN_COMMIT);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const maxStake = Math.min(MAX_COMMIT, Math.max(MIN_COMMIT, state.coins));
  const canStake = state.coins >= MIN_COMMIT;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const finalGoal = goal === "Custom" ? customGoal.trim() || "Custom" : goal;
  const modeLabel = mode === "verified" ? "Verified" : "Standard";

  /** Hands the guest session over to the existing session page, unchanged. */
  async function startWithTheme(theme: SessionThemeId) {
    if (startedRef.current || starting) return;
    const value = signedIn ? stake : 0;
    if (signedIn) {
      if (value < MIN_COMMIT || value > MAX_COMMIT || value > state.coins) {
        setError(`You need at least ${coinLabel(MIN_COMMIT)} to start. Your balance is ${coinLabel(state.coins)}.`);
        setStep("duration");
        return;
      }
      setStarting(true);
      try {
        const claim = await claimActiveDbSession({ goal: finalGoal, duration, value, mode });
        if (!claim.ok) {
          setError("You already have an active session running. Finish or end it first.");
          setStep("duration");
          return;
        }
      } catch (e) {
        setError(actionErrorMessage(e, "Could not start the commitment."));
        setStep("duration");
        return;
      } finally {
        setStarting(false);
      }
    }
    startedRef.current = true;
    // Guests never carry a Focus Shield plan.
    clearShieldPlan();
    clearEndedSession();
    writeActiveVerifiedSession({
      goal: finalGoal,
      duration,
      value,
      mode,
      startedAt: Date.now(),
      accumulatedMs: 0,
      runningSince: Date.now(),
      phase: "focus",
      breakStartedAt: null,
      confirmSince: null,
      breaksTaken: 0,
      nonFocusMs: 0,
      theme,
    });
    navigate({
      to: "/session",
      search: {
        goal: finalGoal,
        duration: String(duration),
        value: String(value),
        mode,
        theme,
      } as Record<string, string>,
    });
  }

  if (step === "theme") {
    return (
      <ThemePicker
        open
        confirmLabel="Commit Now"
        title="Choose your focus theme"
        onCancel={() => setStep("duration")}
        onConfirm={startWithTheme}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${modeLabel} session setup`}
      onClick={onClose}
    >
      <div
        className="animate-landing-modal w-full max-w-md rounded-t-[28px] bg-paper p-7 pb-10 shadow-lift sm:rounded-[28px] sm:p-8 sm:pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
            {modeLabel} · {step === "goal" ? "Step 1 of 3" : "Step 2 of 3"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-ink-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "goal" ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              What are you focusing on?
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {GOALS.map((g) => {
                const active = goal === g.label;
                return (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setGoal(g.label)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-left text-sm transition-colors",
                      active
                        ? "border-ink bg-ink/5 font-medium text-ink"
                        : "border-ink-line text-ink-soft hover:border-ink/30 hover:text-ink",
                    )}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {g.emoji}
                    </span>
                    {g.label}
                  </button>
                );
              })}
            </div>

            {goal === "Custom" ? (
              <input
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="What are you working on?"
                maxLength={60}
                autoFocus
                className="mt-3 w-full rounded-2xl border border-ink-line bg-paper px-4 py-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus:border-ink/40"
              />
            ) : null}

            <button
              type="button"
              onClick={() => setStep("duration")}
              className="group mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ink px-7 py-4 text-sm font-medium text-paper transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
            >
              Continue
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              How long will you commit?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {finalGoal} · {formatDuration(duration)}
            </p>

            <div className="mt-4">
              <DurationWheel value={duration} onChange={setDuration} />
            </div>

            {signedIn ? (
              <div className="mt-5 rounded-2xl border border-ink-line p-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-soft">Commit Cx Coins</span>
                  <span className="font-medium text-ink">{coinLabel(stake)}</span>
                </div>
                {canStake ? (
                  <input
                    type="range"
                    min={MIN_COMMIT}
                    max={maxStake}
                    step={10}
                    value={Math.min(stake, maxStake)}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="mt-3 w-full accent-current"
                    aria-label="Cx Coins to commit"
                  />
                ) : null}
                <p className="mt-2 text-xs text-ink-soft">
                  Balance {coinLabel(state.coins)} · Complete to get them back
                  {coinsForMinutes(duration) > 0 ? ` + earn ${coinLabel(coinsForMinutes(duration))}` : ""}.
                </p>
              </div>
            ) : null}
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

            <button
              type="button"
              disabled={signedIn && !canStake}
              onClick={() => {
                if (signedIn && !canStake) return;
                setError(null);
                setStep("theme");
              }}
              className="group mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ink px-7 py-4 text-sm font-medium text-paper transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
            >
              {signedIn && !canStake ? `Need ${coinLabel(MIN_COMMIT)} to start` : "Continue"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => setStep("goal")}
              className="mt-4 w-full text-center text-xs text-ink-soft underline decoration-ink-line underline-offset-4 transition-colors hover:text-ink"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
