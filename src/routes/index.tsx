import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, CalendarDays, Clock, Flame, Hourglass as HourglassIcon, Leaf, Sparkles } from "lucide-react";
import { MobileShell } from "@/components/BottomNav";
import { CxCoin } from "@/components/CxCoin";
import { DailyGoalProgress } from "@/components/DailyGoalProgress";
import { GroupStudyCard } from "@/components/GroupStudyCard";
import { SwipeToStart } from "@/components/SwipeToStart";
import { TabletHome } from "@/components/TabletHome";
import { useIsTablet } from "@/lib/use-tablet";
import cozyStudy from "@/assets/cozy-study.jpg";

import { useAppState, stats } from "@/lib/commitx-store";
import { dailyMessage } from "@/lib/daily-message";
import {
  usePlans,
  useTodos,
  occursOn,
  upcomingPlan,
  formatTime,
  formatDuration,
  priorityLabel,
} from "@/lib/planner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CommitX — Home" },
      {
        name: "description",
        content:
          "Start a focused commitment. One promise at a time, kept beautifully.",
      },
      { property: "og:title", content: "CommitX — Home" },
      {
        property: "og:description",
        content: "Start a focused commitment. One promise at a time, kept beautifully.",
      },
    ],
  }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const isTablet = useIsTablet();
  if (isTablet) return <TabletHome />;
  return <MobileHome />;
}

function MobileHome() {
  const navigate = useNavigate();
  const { state, hydrated } = useAppState();
  const s = useMemo(() => stats(state.sessions), [state.sessions]);
  
  const { plans, hydrated: plansHydrated } = usePlans();
  const { todos } = useTodos();
  const firstName = state.profile.name.split(" ")[0];
  const message = useMemo(() => dailyMessage(), []);

  // Re-evaluate every 30s so scheduled sessions become "next" at the right time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Today's scheduled sessions from real planner data, earliest first.
  const todays = useMemo(
    () =>
      plans
        .map((p) => ({ plan: p, at: occursOn(p, now) }))
        .filter((r): r is { plan: typeof plans[number]; at: number } => r.at !== null)
        .sort((x, y) => x.at - y.at),
    [plans, now],
  );

  // Most relevant upcoming session (today's remaining ones win, else the next day).
  const next = useMemo(() => upcomingPlan(plans, now), [plans, now]);

  return (
    <MobileShell>
      <div className="px-5 pt-12">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 animate-fade-up">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{greeting()},</p>
            <h1 className="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xl font-semibold text-foreground">
              <span className="truncate">{hydrated ? firstName : "\u00A0"}</span>
              <Leaf className="h-4 w-4 shrink-0 text-primary" />
            </h1>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {hydrated ? message : "\u00A0"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <TopChip
              icon={<CxCoin className="h-4 w-4" />}
              value={hydrated ? String(s.cxCoins) : "—"}
              srLabel="Cx Coins"
            />
            <TopChip
              icon={<Flame className="h-4 w-4 text-accent" />}
              value={hydrated ? String(s.streak) : "—"}
              srLabel="Day streak"
            />
            <Link
              to="/settings"
              hash="notifications"
              aria-label="Notification settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-soft"
            >
              <Bell className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* What should I do next? */}
        <section
          className="mt-5 overflow-hidden rounded-3xl border border-hairline bg-card shadow-soft animate-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          <div className="relative">
            <img
              src={cozyStudy}
              alt="Hand-painted study desk by a sunlit window"
              width={1024}
              height={768}
              loading="lazy"
              className="h-28 w-full object-cover opacity-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <h2 className="absolute bottom-2 left-4 flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
              What should I do next?
              <Sparkles className="h-4 w-4 text-accent" />
            </h2>
          </div>

          <div className="p-4 pt-2">
            <div className="rounded-2xl bg-background p-3.5">
              {plansHydrated && next ? (
                <>
                  <p className="truncate text-base font-semibold text-foreground">
                    {next.plan.subject}
                  </p>
                  {next.plan.topic ? (
                    <p className="truncate text-xs text-foreground/80">{next.plan.topic}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Scheduled {formatTime(next.plan.time)} ·{" "}
                    {priorityLabel(next.plan.priority)} Priority
                  </p>

                  <div className="mt-3">
                    <MiniFact
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="Target duration"
                      value={formatDuration(next.plan.durationMinutes)}
                    />
                  </div>
                </>

              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">
                    {plansHydrated ? "Nothing scheduled today" : "\u00A0"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Add a study plan, or start a commitment right now.
                  </p>
                </>
              )}
            </div>

            <div className="mt-3.5">
              <SwipeToStart
                label="Swipe to Start Commitment"
                onStart={() =>
                    next
                      ? navigate({ to: "/commit" })
                      : navigate({ to: "/planner" })
                  }
              />
            </div>
          </div>
        </section>

        {/* Today's Plan */}
        <section
          className="mt-4 rounded-3xl border border-hairline bg-card p-4 shadow-soft animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              Today's Plan
            </h2>
            <Link to="/planner" className="text-[11px] font-medium text-primary">
              View all
            </Link>
          </div>

          {plansHydrated && (todays.length > 0 || todos.length > 0) ? (
            <ul className="mt-3 divide-y divide-hairline">
              {todays.slice(0, 3).map(({ plan }) => (
                <li key={plan.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {plan.subject}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDuration(plan.durationMinutes)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    Today, {formatTime(plan.time)}
                  </span>
                </li>
              ))}
              {todos.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${
                        t.done ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {t.text}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">To-do</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t.done ? "Done" : "Today"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {plansHydrated ? "Nothing planned for today yet." : "\u00A0"}
            </p>
          )}

          <Link
            to="/planner"
            className="mt-3 flex items-center gap-2 rounded-2xl bg-background px-3.5 py-2.5"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {plansHydrated
                ? `${todays.length + todos.length} ${
                    todays.length + todos.length === 1 ? "task" : "tasks"
                  } planned`
                : "\u00A0"}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">Open</span>
          </Link>
        </section>

        {/* Commit Now */}
        <section
          className="mt-4 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <div className="relative flex items-center justify-center gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              Commit Now
            </h2>
            <Link
              to="/history"
              className="absolute right-0 text-[11px] font-medium text-primary"
            >
              View all
            </Link>
          </div>


          <div className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-hairline bg-card p-4 shadow-soft">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
              <HourglassIcon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                No active commitment
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Start one and stay consistent
              </p>
            </div>
            <Link
              to="/commit"
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Start Now
            </Link>
          </div>
        </section>

        {/* Daily goal */}
        <div className="mt-4 mb-4 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <DailyGoalProgress todayMinutes={s.todayMinutes} hydrated={hydrated} />
        </div>

        {/* Group Study */}
        <div className="mb-4 animate-fade-up" style={{ animationDelay: "360ms" }}>
          <GroupStudyCard />
        </div>
      </div>
    </MobileShell>
  );
}

function TopChip({
  icon,
  value,
  srLabel,
}: {
  icon: ReactNode;
  value: string;
  srLabel: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-card px-3 py-2 shadow-soft"
      aria-label={srLabel}
    >
      {icon}
      <span className="text-xs font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function MiniFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-2.5 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground tabular-nums">
          {value}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}
