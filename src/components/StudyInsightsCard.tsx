import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, ChevronRight, Flame } from "lucide-react";
import { useAppState } from "@/lib/commitx-store";
import { analyze, formatHours } from "@/lib/analytics-data";

/** Compact Study Insights summary for Home — completed sessions only. */
export function StudyInsightsCard() {
  const { state, hydrated } = useAppState();
  const a = useMemo(() => analyze(state.sessions), [state.sessions]);

  return (
    <section className="rounded-3xl border border-hairline bg-card p-5 shadow-soft">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Study insights</p>
            <p className="text-xs text-muted-foreground">From completed commitments</p>
          </div>
        </div>
        <Link
          to="/analytics"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-background px-3 py-1.5 text-[11px] font-medium text-foreground"
        >
          Details
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Cell label="Weekly total" value={hydrated ? formatHours(a.weeklyMinutes) : "—"} />
        <Cell label="Monthly total" value={hydrated ? formatHours(a.monthlyMinutes) : "—"} />
        <Cell
          label="Streak"
          value={hydrated ? `${a.streak}d` : "—"}
          icon={<Flame className="h-3 w-3" />}
        />
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-background px-3 py-3">
      <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 font-display text-base font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
