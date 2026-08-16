import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock } from "lucide-react";
import { formatTime, nextOccurrence, usePlans } from "@/lib/planner";

/** Today's scheduled study sessions, pulled straight from the planner. */
export function TodaysPlan() {
  const { plans, hydrated } = usePlans();

  const today = useMemo(() => {
    const key = new Date().toDateString();
    return plans
      .map((p) => ({ plan: p, at: nextOccurrence(p) }))
      .filter((x) => new Date(x.at).toDateString() === key)
      .sort((a, b) => a.at - b.at);
  }, [plans]);

  return (
    <section className="rounded-3xl border border-hairline bg-card p-5 shadow-soft">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Today's plan</p>
            <p className="text-xs text-muted-foreground">
              {hydrated
                ? today.length
                  ? `${today.length} session${today.length === 1 ? "" : "s"} scheduled`
                  : "Nothing scheduled yet"
                : "\u00A0"}
            </p>
          </div>
        </div>
        <Link
          to="/planner"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-background px-3 py-1.5 text-[11px] font-medium text-foreground"
        >
          Planner
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {hydrated && today.length > 0 && (
        <ul className="mt-4 space-y-2">
          {today.map(({ plan, at }) => (
            <li
              key={plan.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{plan.subject}</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTime(plan.time)} · {plan.durationMinutes} min
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-primary">
                {at <= Date.now() ? "Now" : "Upcoming"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
