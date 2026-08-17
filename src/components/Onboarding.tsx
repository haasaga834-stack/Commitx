import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Hourglass as HourglassIcon,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Hourglass } from "@/components/Hourglass";
import { CxCoin } from "@/components/CxCoin";
import { AmbientNature } from "@/components/AmbientNature";
import {
  formatINR,
  stats,
  useAppState,
  REFERRAL_BONUS,
  WELCOME_DEMO,
  MIN_COMMIT,
  MAX_COMMIT,
} from "@/lib/commitx-store";
import {
  usePlans,
  savePrimaryPlan,
  clampDuration,
  formatDuration,
  DURATION_OPTIONS,
  PRIORITIES,
  priorityLabel,
  type Priority,
} from "@/lib/planner";

/** A time a few minutes from now, so the plan lands on today's schedule. */
function soonTime() {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  if (d.toDateString() !== new Date().toDateString()) return "23:55";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


interface OnboardingProps {
  onDone: () => void;
}

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={
            i === step
              ? "h-1.5 w-6 rounded-full bg-primary transition-all duration-300"
              : "h-1.5 w-1.5 rounded-full bg-hairline transition-all duration-300"
          }
        />
      ))}
    </div>
  );
}

/** Soft halo behind the hero visual so it feels placed, not pasted. */
function Halo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-secondary/50 blur-xl" />
      <span className="absolute inset-4 rounded-full bg-secondary/60" />
      <span className="relative flex items-center justify-center">{children}</span>
    </div>
  );
}

function Bullet({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 text-left">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function FactList({
  icon,
  title,
  items,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  footer?: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-5 text-left shadow-soft">
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        {icon} {title}
      </p>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {footer && (
        <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted-foreground">
          {footer}
        </p>
      )}
    </div>
  );
}

/** Shared screen shell: everything centered, consistent rhythm on every step. */
function Screen({
  visual,
  title,
  text,
  children,
  cta,
  onCta,
  ctaDisabled,
  footer,
}: {
  visual: React.ReactNode;
  title: string;
  text: string;
  children?: React.ReactNode;
  cta: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable content — the CTA below never moves off screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center text-center">
          <div className="mt-4 flex justify-center animate-gentle-float">{visual}</div>

          <h1 className="mt-6 max-w-[19rem] text-balance font-display text-[1.6rem] font-semibold leading-[1.2] tracking-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-[19rem] text-sm leading-relaxed text-muted-foreground">
            {text}
          </p>

          {children && <div className="mt-5 w-full space-y-3">{children}</div>}
        </div>
      </div>

      {/* Fixed footer CTA */}
      <div className="shrink-0 bg-background pt-3">
        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-medium text-primary-foreground shadow-soft transition active:scale-[0.99] disabled:opacity-60"
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </button>
        {footer}
      </div>
    </div>
  );
}


export function Onboarding({ onDone }: OnboardingProps) {
  const router = useRouter();
  const { state } = useAppState();
  const { plans } = usePlans();
  const [step, setStep] = useState(0);

  const s = useMemo(() => stats(state.sessions), [state.sessions]);
  const firstName = (state.profile.name || "there").trim().split(" ")[0];

  // Screen 5 — plan form, prefilled from the user's existing plan when present.
  const existing = plans[0];
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [topic, setTopic] = useState(existing?.topic ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    existing?.durationMinutes ?? 120,
  );
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? "high");
  const [commitValue, setCommitValue] = useState<string>(
    existing?.commitValue ? String(existing.commitValue) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const next = () => setStep((v) => v + 1);

  const finish = (to?: string) => {
    onDone();
    if (to) router.navigate({ to });
  };

  async function savePlan() {
    if (!subject.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const amount = commitValue.trim() ? parseInt(commitValue, 10) : NaN;
      await savePrimaryPlan({
        subject: subject.trim(),
        topic: topic.trim(),
        time: soonTime(),
        durationMinutes: clampDuration(durationMinutes),
        repeat: "daily",
        priority,
        commitValue: Number.isFinite(amount)
          ? Math.min(MAX_COMMIT, Math.max(MIN_COMMIT, amount))
          : undefined,
      });
      finish();
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message
          ? `Couldn't save your plan: ${err.message}`
          : "Couldn't save your plan. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <AmbientNature />
      <div className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-6 pb-6 pt-10">
        <div className="flex items-center justify-between">
          <span className="w-10" />
          <Dots step={step} />
          <button
            type="button"
            onClick={() => finish()}
            className="w-10 text-right text-xs font-medium text-muted-foreground"
          >
            Skip
          </button>
        </div>

        {step === 0 && (
          <Screen
            visual={
              <Halo>
                <Hourglass size={132} state="idle" />
              </Halo>
            }
            title="Make a Commitment"
            text="Pick a task, a duration, and an amount to commit."
            cta="Continue"
            onCta={next}
          >
            <div className="rounded-3xl bg-card p-5 text-left shadow-soft">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Example commitment
              </p>
              <p className="mt-2 font-display text-lg font-semibold leading-snug">
                Revise Physics — Chapter 4
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-primary" /> 1 hour
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HourglassIcon className="h-3.5 w-3.5 text-primary" /> Standard Mode
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/3 rounded-full bg-primary" />
              </div>
            </div>
          </Screen>
        )}

        {step === 1 && (
          <Screen
            visual={
              <Halo>
                <Hourglass size={132} state="running" progress={0.42} />
              </Halo>
            }
            title="Stay Focused"
            text="Two ways to focus. Pick one when you start."
            cta="Next"
            onCta={next}
          >
            <div className="rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<Timer className="h-4 w-4" />}
                title="Standard Mode"
                text="Flexible focus on real time."
              />
            </div>
            <div className="rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Verified Mode"
                text="Strict — leaving the app ends it."
              />
            </div>
          </Screen>
        )}

        {step === 2 && (
          <Screen
            visual={
              <Halo>
                <span className="animate-soft-glow inline-flex h-24 w-24 items-center justify-center rounded-full bg-card shadow-soft">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </span>
              </Halo>
            }
            title="Complete It"
            text="Finish the session, get your commitment back."
            cta="Next"
            onCta={next}
          >
            <div className="flex items-center gap-3 rounded-3xl bg-card p-4 text-left shadow-soft">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Flame className="h-4 w-4 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {firstName}, your streak is {s.streak} day{s.streak === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.completed} completed · {s.cxCoins} Cx Coin
                  {s.cxCoins === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<ListChecks className="h-4 w-4" />}
                title="Planner & To-Do"
                text="Plan sessions and daily tasks."
              />
              <Bullet
                icon={<TrendingUp className="h-4 w-4" />}
                title="Study Insights"
                text="Track your weekly focus hours."
              />
            </div>
          </Screen>
        )}

        {step === 3 && (
          <Screen
            visual={
              <Halo>
                <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-card shadow-soft">
                  <CxCoin className="h-12 w-12" />
                </span>
              </Halo>
            }
            title="Grow With Cx Coins"
            text="1 completed hour = 1 Cx Coin."
            cta="Next"
            onCta={next}
            footer={
              <button
                type="button"
                onClick={() => finish("/how-it-works")}
                className="mt-3 w-full rounded-2xl bg-card py-4 text-sm font-medium text-muted-foreground shadow-soft"
              >
                How CommitX Works
              </button>
            }

          >
            <FactList
              icon={<CxCoin className="h-4 w-4" />}
              title="Cx Coins"
              items={[
                "Not cash — they cannot be transferred.",
                "Save them for Cx Coupons (coming soon).",
              ]}
            />

            <FactList
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Demo Money"
              items={[
                `${formatINR(WELCOME_DEMO)} to start · ${formatINR(REFERRAL_BONUS)} per referral.`,
                "Virtual only — no cash value.",
              ]}
              footer={`Your demo balance: ${formatINR(state.balances.demo)}`}
            />
          </Screen>
        )}

        {step === 4 && (
          <Screen
            visual={
              <Halo>
                <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-card shadow-soft">
                  <Target className="h-11 w-11 text-primary" />
                </span>
              </Halo>
            }
            title="What should I do next?"
            text="Add today's focus session."
            cta={saving ? "Saving…" : "Set My Plan"}
            onCta={savePlan}
            ctaDisabled={saving || !subject.trim()}
            footer={
              saveError ? (
                <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive">
                  {saveError} Tap “Set My Plan” to retry.
                </p>
              ) : null
            }
          >
            <div className="space-y-3 rounded-3xl bg-card p-5 text-left shadow-soft">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Subject
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Medicine"
                  className="mt-1.5 w-full rounded-2xl bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>

              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Topic / Task
                </span>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Cardiology"
                  className="mt-1.5 w-full rounded-2xl bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>

              <div>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Duration
                </span>
                <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                  {DURATION_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDurationMinutes(m)}
                      className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition ${
                        durationMinutes === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {formatDuration(m)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Priority
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-2xl py-2.5 text-xs font-medium transition ${
                        priority === p
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {priorityLabel(p)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Commitment amount (optional)
                </span>
                <input
                  value={commitValue}
                  onChange={(e) => setCommitValue(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={`₹${MIN_COMMIT} – ₹${MAX_COMMIT}`}
                  className="mt-1.5 w-full rounded-2xl bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>
          </Screen>
        )}

      </div>
    </div>
  );
}
