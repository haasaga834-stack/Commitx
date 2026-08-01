import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { formatGoalHours, useDailyGoal } from "@/lib/planner";

export function DailyGoalProgress({
  todayMinutes,
  hydrated,
}: {
  todayMinutes: number;
  hydrated: boolean;
}) {
  const { goalHours } = useDailyGoal();
  const goalMinutes = Math.max(1, Math.round(goalHours * 60));
  const pct = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
  const done = todayMinutes >= goalMinutes;

  const studied =
    todayMinutes >= 60
      ? `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`
      : `${todayMinutes}m`;

  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Daily study progress</p>
          <p className="text-xs text-muted-foreground">
            Goal · {formatGoalHours(goalHours)} a day
          </p>
        </div>
        <Link
          to="/planner"
          className="shrink-0 rounded-full border border-hairline bg-background px-3 py-1.5 text-[11px] font-medium text-foreground"
        >
          Edit goal
        </Link>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${hydrated ? pct : 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {hydrated ? studied : "—"} of {formatGoalHours(goalHours)}
        </span>
        <span className={done ? "font-medium text-primary" : "text-muted-foreground"}>
          {hydrated ? (done ? "Goal reached" : `${pct}%`) : ""}
        </span>
      </div>
    </div>
  );
}
