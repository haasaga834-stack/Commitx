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
              ? "h-1.5 w-6 rounded-full bg-primary transition-all"
              : "h-1.5 w-1.5 rounded-full bg-hairline transition-all"
          }
        />
      ))}
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
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function Onboarding({ onDone }: OnboardingProps) {
  const router = useRouter();
  const { state } = useAppState();
  const [step, setStep] = useState(0);

  const s = useMemo(() => stats(state.sessions), [state.sessions]);
  const firstName = (state.profile.name || "there").trim().split(" ")[0];

  const next = () => setStep((v) => v + 1);

  const finish = (to?: string) => {
    onDone();
    if (to) router.navigate({ to });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-10 pt-14">
        <div className="flex items-center justify-between">
          <Dots step={step} />
          <button
            type="button"
            onClick={() => finish()}
            className="text-xs font-medium text-muted-foreground"
          >
            Skip
          </button>
        </div>

        {step === 0 && (
          <div className="mt-10 flex flex-1 flex-col">
            <div className="flex justify-center">
              <Hourglass size={150} state="idle" />
            </div>
            <h1 className="mt-10 font-display text-3xl font-semibold leading-tight">
              Make a Commitment
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Choose what you want to accomplish and how long you'll focus.
            </p>

            <div className="mt-8 rounded-3xl bg-card p-5 shadow-soft">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Example commitment
              </p>
              <p className="mt-2 font-display text-lg font-semibold">
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

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={next}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-medium text-primary-foreground shadow-soft"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-10 flex flex-1 flex-col">
            <div className="flex justify-center">
              <Hourglass size={150} state="running" progress={0.42} />
            </div>
            <h1 className="mt-10 font-display text-3xl font-semibold leading-tight">
              Stay Focused Until It's Done
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              CommitX keeps you accountable while you work.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-3xl bg-card p-5 shadow-soft">
                <Bullet
                  icon={<Timer className="h-3.5 w-3.5" />}
                  title="Standard Mode"
                  text="Flexible focus. Your timer keeps running on real time, even if life interrupts."
                />
              </div>
              <div className="rounded-3xl bg-card p-5 shadow-soft">
                <Bullet
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  title="Verified Mode"
                  text="Strict accountability. Stay inside CommitX for the full session — leaving ends it."
                />
              </div>
            </div>

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={next}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-medium text-primary-foreground shadow-soft"
              >
                Keep Focusing <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-10 flex flex-1 flex-col">
            <div className="flex justify-center">
              <div className="animate-soft-glow rounded-full bg-secondary/60 p-6">
                <CheckCircle2 className="h-16 w-16 text-primary" />
              </div>
            </div>
            <h1 className="mt-10 font-display text-3xl font-semibold leading-tight">
              Complete It. Build Your Streak.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Every successful commitment moves you forward.
            </p>

            <div className="mt-6 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Flame className="h-4 w-4 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {firstName}, your streak is {s.streak} day{s.streak === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.completed} commitment{s.completed === 1 ? "" : "s"} completed ·{" "}
                  {s.cxCoins} Cx Coin{s.cxCoins === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3 rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<ListChecks className="h-3.5 w-3.5" />}
                title="Study Planner & To-Do List"
                text="Plan sessions and tasks, then work through them one by one."
              />
              <Bullet
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                title="Study Insights"
                text="See your focus hours and consistency curve over the week."
              />
              <Bullet
                icon={<Leaf className="h-3.5 w-3.5" />}
                title="5-minute Recovery Break"
                text="After every completed hour, pause, breathe and come back refreshed."
              />
              <Bullet
                icon={<CxCoin className="h-3.5 w-3.5" />}
                title="Cx Coins"
                text="Earned for every successfully completed focus hour."
              />
            </div>

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={next}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-medium text-primary-foreground shadow-soft"
              >
                Build My Streak <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-10 flex flex-1 flex-col">
            <div className="flex justify-center">
              <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-secondary/60">
                <CxCoin className="h-12 w-12" />
              </span>
            </div>
            <h1 className="mt-8 font-display text-3xl font-semibold leading-tight">
              Commit. Complete. Get It Back.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Complete your commitments, build your streak and earn Cx Coins through
              successful focus hours.
            </p>

            <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <CxCoin className="h-4 w-4" /> Cx Coins
              </p>
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>1 completed hour = 1 Cx Coin.</li>
                <li>Cx Coins are not cash.</li>
                <li>Cx Coins cannot be withdrawn.</li>
                <li>Cx Coins cannot be transferred.</li>
                <li>Save Cx Coins for future Cx Coupon redemption.</li>
                <li>Cx Coupons are Coming Soon.</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                You have {s.cxCoins} Cx Coin{s.cxCoins === 1 ? "" : "s"} right now.
              </p>
            </div>

            <div className="mt-3 rounded-3xl bg-card p-5 shadow-soft">
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> Demo Money
              </p>
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>New users receive {formatINR(WELCOME_DEMO)} Demo Money.</li>
                <li>Referrals can provide {formatINR(REFERRAL_BONUS)} Demo Money.</li>
                <li>Demo Money is virtual and has no cash value.</li>
                <li>Demo Money cannot be withdrawn or transferred.</li>
                <li>Real-money deposits and withdrawals are currently not active.</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Your demo balance: {formatINR(state.balances.demo)}
              </p>
            </div>

            <div className="mt-3 space-y-3 rounded-3xl bg-card p-5 shadow-soft">
              <Bullet
                icon={<Smartphone className="h-3.5 w-3.5" />}
                title="Screen Time"
                text="Track your daily phone use and set a healthy limit in Settings."
              />
              <Bullet
                icon={<BellRing className="h-3.5 w-3.5" />}
                title="Notifications"
                text="Gentle reminders for plans and to-dos — turn them on or off anytime."
              />
              <Bullet
                icon={<Leaf className="h-3.5 w-3.5" />}
                title="Recovery Break"
                text="A mandatory 5-minute rest after each completed focus hour."
              />
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Want to know more about CommitX?
            </p>
            <div className="mt-3 space-y-3 pb-2">
              <button
                type="button"
                onClick={() => finish("/how-it-works")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-medium text-primary-foreground shadow-soft"
              >
                How CommitX Works <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => finish()}
                className="w-full rounded-2xl bg-card py-4 text-sm font-medium text-muted-foreground shadow-soft"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
