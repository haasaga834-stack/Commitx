import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState } from "@/lib/commitx-store";
import { analyze, formatHours } from "@/lib/analytics-data";
import { useMemo } from "react";
import { Flame, TrendingUp, CalendarDays, Clock, History } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "CommitX — Analytics" },
      { name: "description", content: "Weekly, monthly and daily study hour insights." },
      { property: "og:title", content: "CommitX — Analytics" },
      {
        property: "og:description",
        content: "Weekly, monthly and daily study hour insights.",
      },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const { state, hydrated } = useAppState();
  const a = useMemo(() => analyze(state.sessions), [state.sessions]);
  const peak = Math.max(60, ...a.week.map((d) => d.minutes));

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Analytics</p>
            <h1 className="mt-2 truncate text-3xl font-semibold">Study insights</h1>
          </div>
          <Link
            to="/history"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="History"
          >
            <History className="h-4 w-4" />
          </Link>
        </div>

        {/* Weekly bar graph */}
        <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                This week
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                {hydrated ? formatHours(a.weeklyMinutes) : "—"}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 shrink-0 text-primary" />
          </div>

          <WeekCurve week={a.week} peak={peak} />

        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={<CalendarDays className="h-4 w-4" />}
            label="Weekly total"
            value={hydrated ? formatHours(a.weeklyMinutes) : "—"}
          />
          <Metric
            icon={<CalendarDays className="h-4 w-4" />}
            label="Monthly total"
            value={hydrated ? formatHours(a.monthlyMinutes) : "—"}
          />
          <Metric
            icon={<Clock className="h-4 w-4" />}
            label="Avg daily"
            value={hydrated ? formatHours(a.averageDailyMinutes) : "—"}
          />
          <Metric
            icon={<Flame className="h-4 w-4" />}
            label="Current streak"
            value={hydrated ? `${a.streak}d` : "—"}
          />
        </div>

        <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            All-time study hours
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {hydrated ? formatHours(a.totalMinutes) : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Counted from completed commitments only.
          </p>
        </div>
      </div>
    </MobileShell>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="min-w-0 truncate text-[11px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
