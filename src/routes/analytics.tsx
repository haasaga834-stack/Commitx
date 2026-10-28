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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
            small
          />
          <Metric
            icon={<CalendarDays className="h-4 w-4" />}
            label="Monthly total"
            value={hydrated ? formatHours(a.monthlyMinutes) : "—"}
            small
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

/** Soft, hand-drawn style weekly curve — shape over numbers. */
function WeekCurve({
  week,
  peak,
}: {
  week: { label: string; minutes: number; isToday: boolean }[];
  peak: number;
}) {
  const W = 320;
  const H = 132;
  const pad = 14;
  const step = (W - pad * 2) / (week.length - 1);
  const pts = week.map((d, i) => ({
    x: pad + i * step,
    y: H - pad - (Math.min(1, d.minutes / peak) * (H - pad * 2)),
    ...d,
  }));

  // Smooth Catmull-Rom style path through the points.
  const line = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${H - pad} L ${pts[0].x} ${H - pad} Z`;

  return (
    <div className="mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label="Weekly study curve">
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={pad}
            x2={W - pad}
            y1={pad + (H - pad * 2) * g}
            y2={pad + (H - pad * 2) * g}
            stroke="var(--color-muted)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        ))}

        <path d={area} fill="url(#curveFill)" />
        <path
          d={line}
          fill="none"
          stroke="url(#curveStroke)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {pts.map((p) => (
          <g key={p.label}>
            {p.isToday && (
              <circle cx={p.x} cy={p.y} r="8" fill="var(--color-primary)" opacity="0.16" />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.isToday ? 4.5 : 3}
              fill={p.minutes > 0 ? "var(--color-primary)" : "var(--color-muted)"}
              stroke="var(--color-card)"
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>

      <div className="mt-2 flex justify-between px-1">
        {week.map((d) => (
          <span
            key={d.label}
            className={`text-[11px] font-medium ${
              d.isToday ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}


function Metric({
  icon,
  label,
  value,
  small = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="min-w-0 truncate text-[11px] uppercase tracking-wider">{label}</p>
      </div>
      <p
        className={`mt-1 font-display font-semibold tabular-nums ${
          small ? "text-lg" : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
