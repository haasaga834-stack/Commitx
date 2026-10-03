import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Clock,
  Flame,
  Hourglass as HourglassIcon,
  Sparkles,
} from "lucide-react";
import { CxCoin } from "@/components/CxCoin";
import { CxCoinPopup } from "@/components/CxCoinPopup";
import { DailyGoalProgress } from "@/components/DailyGoalProgress";
import { GroupStudyCard } from "@/components/GroupStudyCard";
import { SwipeToStart } from "@/components/SwipeToStart";
import { TabletShell } from "@/components/TabletShell";
import moonlitBotanical from "@/assets/moonlit-botanical-terrarium.jpg";

import { useAppState, stats } from "@/lib/commitx-store";
import { dailyMessage } from "@/lib/daily-message";
import { cn } from "@/lib/utils";
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
  const s = useMemo(() => stats(state.sessions), [state.sessions]);

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

  return (
    <TabletShell>
      {/* Top bar */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="truncate font-display text-3xl font-semibold text-foreground lg:text-4xl">
            <span className="sr-only">CommitX study dashboard — </span>
            {hydrated ? firstName : "\u00A0"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            {hydrated ? message : "\u00A0"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <CxCoinPopup coins={state.coins} hydrated={hydrated}>
            <Stat
              icon={<CxCoin className="h-5 w-5" />}
              value={hydrated ? String(state.coins) : "—"}
              label="Cx Coins"
              clickable
            />
          </CxCoinPopup>
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
                src={moonlitBotanical}
                alt="Moonlit botanical focus garden"
                width={1400}
                height={800}
                loading="eager"
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
                  onStart={() =>
                    next
                      ? navigate({ to: "/commit", search: { plan: 1 } })
                      : navigate({ to: "/planner" })
                  }
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
          {/* Commit Now */}
          <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
            <div className="relative flex items-center justify-center gap-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Commit Now
              </h2>
              <Link to="/history" className="absolute right-0 text-xs font-medium text-primary">
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

          {/* Group Study */}
          <GroupStudyCard />
        </div>
      </div>
    </TabletShell>
  );
}

function Stat({
  icon,
  value,
  label,
  clickable,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  clickable?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border border-hairline bg-card px-4 py-2.5 shadow-soft",
        clickable && "cursor-pointer transition-transform active:scale-95 hover:shadow-lift",
      )}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
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
