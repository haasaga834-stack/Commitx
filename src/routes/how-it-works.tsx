import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import {
  ArrowLeft,
  ShieldCheck,
  Timer,
  Wallet,
  Sparkles,
  CheckCircle2,
  XCircle,
  FlaskConical,
} from "lucide-react";
import { formatINR, MIN_COMMIT, MAX_COMMIT } from "@/lib/commitx-store";
import { CxCoin } from "@/components/CxCoin";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How CommitX Works — Commitments, Modes & Cx Coins" },
      {
        name: "description",
        content:
          "Understand CommitX commitments, Standard and Verified Mode, demo money, Cx Coins & Cx Coupons, success and failure rules, and the beta phase.",
      },
      { property: "og:title", content: "How CommitX Works" },
      {
        property: "og:description",
        content:
          "Commitments, Standard vs Verified Mode, demo money, Cx Coins & Cx Coupons and what happens on success or failure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="min-w-0 truncate font-display text-2xl font-semibold">
            How CommitX works
          </h1>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Commit. Complete. Get it back. You promise a block of focused time and put a
          small amount behind it — finish, and it comes straight back to you.
        </p>

        <div className="mt-8 space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          <Section
            icon={<Timer className="h-4 w-4" />}
            title="Commitments"
            delay={0}
            points={[
              "Pick a goal, a duration and an amount to put behind it.",
              `Commitments range from ${formatINR(MIN_COMMIT)} to ${formatINR(MAX_COMMIT)}.`,
              "The amount is set aside while the session runs — not spent.",
              "The hourglass shows real elapsed time, so you always know where you stand.",
            ]}
          />

          <Section
            icon={<Sparkles className="h-4 w-4" />}
            title="Standard Mode"
            delay={60}
            points={[
              "Relaxed focus: you may leave the app if you need to.",
              "The timer runs on real clock time, so screen-off and app switching never lose progress.",
              "Ending a session early through the exit dialog forfeits the commitment.",
            ]}
          />

          <Section
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Verified Mode"
            delay={120}
            points={[
              "Strict focus: Do Not Disturb must be on before the timer starts.",
              "Leaving CommitX — Home, Recents, another app or split-screen — fails the session immediately.",
              "Emergencies are covered by a 60-second grace window, so a quick call is fine.",
              "Screen lock, notifications, volume and brightness never fail a session.",
            ]}
          />

          <Section
            icon={<Wallet className="h-4 w-4" />}
            title="Demo money"
            delay={180}
            points={[
              "CommitX runs entirely on virtual demo money — nothing is charged.",
              "New accounts start with ₹300 demo money, and a valid referral code adds ₹100.",
              "Demo money is used only to back your commitments inside the app.",
            ]}
          />

          <Section
            icon={<CxCoin className="h-4 w-4" />}
            title="Cx Coins & Cx Coupons"
            delay={240}
            points={[
              "1 successfully completed hour of focus = 1 Cx Coin. A 30-minute session earns 0, two hours earn 2.",
              "Cancelled, failed or incomplete sessions earn nothing.",
              "Cx Coins are not cash and cannot be transferred.",
              "They accumulate on your account, so you can save them up over time.",
              "Your Cx Coin balance is shown in the Home top banner.",
            ]}
          >
            <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
              <div className="flex items-center gap-2">
                <CxCoin className="h-4 w-4" />
                <p className="text-sm font-medium">Cx Coupons — Coming Soon</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Saved Cx Coins may eventually be redeemed for Cx Coupons offering
                benefits across eligible education, books and e-learning, food or
                future partner services. Nothing is redeemable yet, and no
                partnerships are confirmed — we'll announce them inside the app.
              </p>
            </div>
          </Section>

          <Section
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Success & failure"
            delay={300}
            points={[
              "Complete the session: your commitment is returned in full, your streak grows and coins are added.",
              "Fail or end early: the committed amount is forfeited and the session is logged as failed.",
              "Every session — kept or lost — appears in your history and stats.",
            ]}
          />

          <Section
            icon={<FlaskConical className="h-4 w-4" />}
            title="Beta phase"
            delay={360}
            points={[
              "CommitX is in open beta: features and rules may still change.",
              "Everything runs on virtual demo money, so it is safe to experiment.",
              "Your data syncs to your account, so it follows you across devices.",
            ]}
          />
        </div>

        <div className="mt-6 mb-4 rounded-3xl bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">One rule to remember</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            A session can only end two ways: you finish it, or you choose to end it. There
            is no pause button — that is the point.
          </p>
          <Link
            to="/commit"
            className="mt-5 block w-full rounded-full bg-primary px-6 py-4 text-center text-sm font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
          >
            Start a commitment
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

function Section({
  icon,
  title,
  points,
  delay,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  points: string[];
  delay: number;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-3xl bg-card p-5 shadow-soft animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
          {icon}
        </span>
        <h2 className="min-w-0 text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <ul className="mt-3 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
            <span className="min-w-0">{p}</span>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
