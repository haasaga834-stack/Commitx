import { useMemo } from "react";
import { Clock, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatTime, nextOccurrence, usePlans, useTodos } from "@/lib/planner";
import { formatINR, MIN_COMMIT, useAppState } from "@/lib/commitx-store";
import { SwipeToStart } from "@/components/SwipeToStart";

/** Small hand-painted desk-lamp-and-book vignette. Purely decorative. */
function CozyDesk() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 72"
      className="h-16 w-20 shrink-0 animate-gentle-float"
      fill="none"
    >
      <ellipse cx="50" cy="66" rx="34" ry="4" fill="var(--color-primary)" opacity="0.12" />
      {/* warm glow */}
      <circle cx="34" cy="26" r="20" fill="var(--color-accent)" opacity="0.16" />
      {/* lamp */}
      <path
        d="M24 20h20l-6 10H30l-6-10Z"
        fill="var(--color-primary)"
        opacity="0.85"
      />
      <path d="M34 30v26" stroke="var(--color-primary)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M26 58h16" stroke="var(--color-primary)" strokeWidth="2.4" strokeLinecap="round" />
      {/* book */}
      <path
        d="M52 58c4-6 12-6 16 0 4-6 12-6 16 0-5 3-11 3-16 0-5 3-11 3-16 0Z"
        fill="var(--color-clay)"
        opacity="0.75"
      />
      {/* leaf sprig */}
      <path
        d="M78 44c-6 2-8 8-6 12 5 1 9-3 9-8 0-2-1-3-3-4Z"
        fill="var(--color-accent)"
        opacity="0.6"
      />
    </svg>
  );
}

/**
 * "What Should I Do Next?" — the primary Home focus. Everything shown here is
 * derived from real planner, to-do and commitment data; nothing is invented.
 */
export function NextUpCard({ onStart }: { onStart: () => void }) {
  const { plans, hydrated: plansHydrated } = usePlans();
  const { todos, hydrated: todosHydrated } = useTodos();
  const { state, hydrated } = useAppState();

  const next = useMemo(() => {
    if (!plans.length) return null;
    return [...plans].sort((a, b) => nextOccurrence(a) - nextOccurrence(b))[0];
  }, [plans]);

  const topic = todos.find((t) => !t.done)?.text ?? null;

  const lastValue = state.sessions[0]?.value;
  const suggestedValue = lastValue && lastValue > 0 ? lastValue : MIN_COMMIT;
  const duration = next?.durationMinutes ?? state.sessions[0]?.durationMinutes ?? 30;

  const ready = plansHydrated && todosHydrated && hydrated;

  const durationLabel =
    duration >= 60
      ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ""}`
      : `${duration}m`;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-hairline bg-card p-5 shadow-lift">
      <div className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-gradient-sun opacity-30 blur-2xl" />

      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            What should I do next?
          </p>
          <h2 className="mt-2 truncate font-display text-2xl font-semibold text-foreground">
            {!ready ? "\u00A0" : next ? next.subject : "Pick your focus"}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {!ready
              ? "\u00A0"
              : topic
                ? topic
                : next
                  ? `Scheduled for ${formatTime(next.time)}`
                  : "Add a study plan or a to-do to see your next priority here."}
          </p>
        </div>
        <CozyDesk />
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-medium text-foreground">
          <Clock className="h-3.5 w-3.5" />
          {durationLabel}
        </span>
        <span className="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-medium text-primary">
          {ready ? formatINR(suggestedValue) : "—"} commitment
        </span>
        {next && (
          <span className="rounded-full bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {formatTime(next.time)}
          </span>
        )}
      </div>

      <div className="relative mt-5">
        <SwipeToStart onStart={onStart} />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Slide right when you're ready to commit.
        </p>
      </div>

      {ready && !next && (
        <Link
          to="/planner"
          className="relative mt-3 block text-center text-xs font-medium text-primary"
        >
          Plan a study session
        </Link>
      )}
    </section>
  );
}
