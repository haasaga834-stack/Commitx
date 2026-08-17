import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Flame,
  Hourglass as HourglassIcon,
  Leaf,
  ListChecks,
  ShieldCheck,
  Smartphone,
  Sparkles,
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
} from "@/lib/commitx-store";

interface OnboardingProps {
  onDone: () => void;
}

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3].map((i) => (
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
    <div className="flex flex-1 flex-col items-center text-center">
      <div className="mt-6 flex justify-center animate-gentle-float">{visual}</div>

      <h1 className="mt-8 max-w-[19rem] text-balance font-display text-[1.75rem] font-semibold leading-[1.2] tracking-tight">
        {title}
      </h1>
      <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>

      {children && <div className="mt-7 w-full space-y-3">{children}</div>}

      <div className="mt-auto w-full pt-9">
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <AmbientNature />
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-10 pt-12">
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
            text="Choose what you want to accomplish and how long you'll focus."
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
            title="Stay Focused Until It's Done"
            text="CommitX keeps you accountable while you work."
            cta="Keep Focusing"
            onCta={next}
          >
            <div className="rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<Timer className="h-4 w-4" />}
                title="Standard Mode"
                text="Flexible focus. Your timer keeps running on real time, even if life interrupts."
              />
            </div>
            <div className="rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Verified Mode"
                text="Strict accountability. Stay inside CommitX for the full session — leaving ends it."
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
            title="Complete It. Build Your Streak."
            text="Every successful commitment moves you forward."
            cta="Build My Streak"
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
                  {s.completed} commitment{s.completed === 1 ? "" : "s"} completed ·{" "}
                  {s.cxCoins} Cx Coin{s.cxCoins === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<ListChecks className="h-4 w-4" />}
                title="Study Planner & To-Do List"
                text="Plan sessions and tasks, then work through them one by one."
              />
              <Bullet
                icon={<TrendingUp className="h-4 w-4" />}
                title="Study Insights"
                text="See your focus hours and consistency curve over the week."
              />
              <Bullet
                icon={<Leaf className="h-4 w-4" />}
                title="5-minute Recovery Break"
                text="After every completed hour, pause, breathe and come back refreshed."
              />
              <Bullet
                icon={<CxCoin className="h-4 w-4" />}
                title="Cx Coins"
                text="Earned for every successfully completed focus hour."
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
            title="Commit. Complete. Get It Back."
            text="Complete your commitments, build your streak and earn Cx Coins through successful focus hours."
            cta="How CommitX Works"
            onCta={() => finish("/how-it-works")}
            footer={
              <button
                type="button"
                onClick={() => finish()}
                className="mt-3 w-full rounded-2xl bg-card py-4 text-sm font-medium text-muted-foreground shadow-soft"
              >
                Skip
              </button>
            }
          >
            <FactList
              icon={<CxCoin className="h-4 w-4" />}
              title="Cx Coins"
              items={[
                "1 completed hour = 1 Cx Coin.",
                "Cx Coins are not cash.",
                "Cx Coins cannot be withdrawn.",
                "Cx Coins cannot be transferred.",
                "Save Cx Coins for future Cx Coupon redemption.",
                "Cx Coupons are Coming Soon.",
              ]}
              footer={`You have ${s.cxCoins} Cx Coin${s.cxCoins === 1 ? "" : "s"} right now.`}
            />

            <FactList
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Demo Money"
              items={[
                `New users receive ${formatINR(WELCOME_DEMO)} Demo Money.`,
                `Referrals can provide ${formatINR(REFERRAL_BONUS)} Demo Money.`,
                "Demo Money is virtual and has no cash value.",
                "Demo Money cannot be withdrawn or transferred.",
                "Real-money deposits and withdrawals are currently not active.",
              ]}
              footer={`Your demo balance: ${formatINR(state.balances.demo)}`}
            />

            <div className="space-y-4 rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<Smartphone className="h-4 w-4" />}
                title="Screen Time"
                text="Track your daily phone use and set a healthy limit in Settings."
              />
              <Bullet
                icon={<BellRing className="h-4 w-4" />}
                title="Notifications"
                text="Gentle reminders for plans and to-dos — turn them on or off anytime."
              />
              <Bullet
                icon={<Leaf className="h-4 w-4" />}
                title="Recovery Break"
                text="A mandatory 5-minute rest after each completed focus hour."
              />
            </div>

            <p className="pt-2 text-sm text-muted-foreground">
              Want to know more about CommitX?
            </p>
          </Screen>
        )}
      </div>
    </div>
  );
}
