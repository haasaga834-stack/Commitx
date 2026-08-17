import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Clock,
  Flame,
  Hourglass as HourglassIcon,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { CxCoin } from "@/components/CxCoin";
import { DailyGoalProgress } from "@/components/DailyGoalProgress";
import { SwipeToStart } from "@/components/SwipeToStart";
import { TabletShell } from "@/components/TabletShell";
import cozyStudy from "@/assets/cozy-study.jpg";

import { useAppState, stats } from "@/lib/commitx-store";
import { analyze, formatHours } from "@/lib/analytics-data";
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Purpose-built tablet dashboard. Same data + logic as the phone Home. */
export function TabletHome() {
  const navigate = useNavigate();
  const { state, hydrated } = useAppState();
  const s = stats(state.sessions);
  const a = useMemo(() => analyze(state.sessions), [state.sessions]);

  const { plans, hydrated: plansHydrated } = usePlans();
  const { todos } = useTodos();
  const firstName = state.profile.name.split(" ")[0];
  const message = useMemo(() => dailyMessage(), []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const todays = useMemo(
    () =>
      plans
        .map((p) => ({ plan: p, at: occursOn(p, now) }))
        .filter((r): r is { plan: (typeof plans)[number]; at: number } => r.at !== null)
        .sort((x, y) => x.at - y.at),
    [plans, now],
  );

  const next = useMemo(() => upcomingPlan(plans, now), [plans, now]);
  const taskCount = todays.length + todos.length;
  const weekMax = Math.max(1, ...a.week.map((d) => d.minutes));

  return (
    <TabletShell>
      {/* Top bar */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="truncate font-display text-3xl font-semibold text-foreground lg:text-4xl">
            {hydrated ? firstName : "\u00A0"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            {hydrated ? message : "\u00A0"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Stat
            icon={<CxCoin className="h-5 w-5" />}
            value={hydrated ? String(s.cxCoins) : "—"}
            label="Cx Coins"
          />
          <Stat
            icon={<Flame className="h-5 w-5 text-accent" />}
            value={hydrated ? String(s.streak) : "—"}
            label="Day streak"
          />
          <Link
            to="/settings"
            hash="notifications"
            aria-label="Notification settings"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-hairline bg-card text-foreground shadow-soft"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* MAIN COLUMN */}
        <div className="grid gap-6">
          {/* What should I do next? */}
          <section className="overflow-hidden rounded-3xl border border-hairline bg-card shadow-soft">
            <div className="relative">
              <img
                src={cozyStudy}
                alt="Hand-painted study desk by a sunlit window"
                width={1024}
                height={768}
                loading="lazy"
                className="h-40 w-full object-cover opacity-95"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
              <h2 className="absolute bottom-3 left-6 flex items-center gap-2 font-display text-xl font-semibold text-foreground">
                What should I do next?
                <Sparkles className="h-5 w-5 text-accent" />
              </h2>
            </div>

            <div className="p-6 pt-4">
              <div className="grid gap-4 rounded-2xl bg-background p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                {plansHydrated && next ? (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">
                        {next.plan.subject}
                      </p>
                      {next.plan.topic ? (
                        <p className="truncate text-sm text-foreground/80">
                          {next.plan.topic}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Scheduled {formatTime(next.plan.time)} ·{" "}
                        {priorityLabel(next.plan.priority)} Priority
                      </p>
                    </div>
                    <MiniFact
                      icon={<Clock className="h-4 w-4" />}
                      label="Target duration"
                      value={formatDuration(next.plan.durationMinutes)}
                    />
                  </>
                ) : (
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground">
                      {plansHydrated ? "Nothing scheduled today" : "\u00A0"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a study plan, or start a commitment right now.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 max-w-xl">
                <SwipeToStart
                  label="Swipe to Start Commitment"
                  onStart={() => navigate({ to: "/commit" })}
                />
              </div>
            </div>
          </section>

          {/* Today's Plan */}
          <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Today's Plan
              </h2>
              <Link to="/planner" className="text-xs font-medium text-primary">
                View all
              </Link>
            </div>

            {plansHydrated && taskCount > 0 ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {todays.slice(0, 4).map(({ plan }) => (
                  <li
                    key={plan.id}
                    className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {plan.subject}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDuration(plan.durationMinutes)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTime(plan.time)}
                    </span>
                  </li>
                ))}
                {todos.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${
                          t.done ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {t.text}
                      </span>
                      <span className="block text-xs text-muted-foreground">To-do</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t.done ? "Done" : "Today"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {plansHydrated ? "Nothing planned for today yet." : "\u00A0"}
              </p>
            )}

            <Link
              to="/planner"
              className="mt-4 flex items-center gap-3 rounded-2xl bg-background px-4 py-3"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {plansHydrated
                  ? `${taskCount} ${taskCount === 1 ? "task" : "tasks"} planned`
                  : "\u00A0"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Open planner</span>
            </Link>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="grid gap-6">
          {/* Study Insights */}
          <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Study Insights
              </h2>
              <Link to="/analytics" className="text-xs font-medium text-primary">
                See all
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Insight
                icon={<CalendarDays className="h-4 w-4" />}
                label="This week"
                value={hydrated ? formatHours(a.weeklyMinutes) : "—"}
              />
              <Insight
                icon={<TrendingUp className="h-4 w-4" />}
                label="Success rate"
                value={hydrated ? `${s.successRate}%` : "—"}
              />
              <Insight
                icon={<Clock className="h-4 w-4" />}
                label="Avg daily"
                value={hydrated ? formatHours(a.averageDailyMinutes) : "—"}
              />
              <Insight
                icon={<Trophy className="h-4 w-4" />}
                label="Longest streak"
                value={hydrated ? `${s.longest}d` : "—"}
              />
            </div>

            {/* Real weekly focus minutes */}
            <div className="mt-5 flex items-end gap-2">
              {a.week.map((d) => (
                <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`w-full rounded-t-md ${
                      d.isToday ? "bg-primary" : "bg-primary/25"
                    }`}
                    style={{ height: `${8 + (d.minutes / weekMax) * 64}px` }}
                    aria-label={`${d.label}: ${formatHours(d.minutes)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.label[0]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Current Commit Now */}
          <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Current Commit Now
              </h2>
              <Link to="/history" className="text-xs font-medium text-primary">
                View all
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-primary">
                <HourglassIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  No active commitment
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Start one and stay consistent
                </p>
              </div>
            </div>

            <Link
              to="/commit"
              className="mt-4 flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Start Now
            </Link>
          </section>

          {/* Daily goal */}
          <DailyGoalProgress todayMinutes={s.todayMinutes} hydrated={hydrated} />
        </div>
      </div>
    </TabletShell>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-hairline bg-card px-4 py-2.5 shadow-soft">
      {icon}
      <span className="min-w-0">
        <span className="block text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

function MiniFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function Insight({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-background px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="min-w-0 truncate text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
