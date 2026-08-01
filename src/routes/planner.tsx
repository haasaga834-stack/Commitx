import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useMemo, useState } from "react";
import {
  usePlans,
  addPlan,
  removePlan,
  formatTime,
  repeatLabel,
  nextOccurrence,
  requestNotificationPermission,
  useDailyGoal,
  formatGoalHours,
  WEEKDAYS,
  type Repeat,
} from "@/lib/planner";
import { BookOpen, Bell, Plus, Trash2, Clock, Target } from "lucide-react";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "CommitX — Study Planner" },
      {
        name: "description",
        content: "Plan daily, weekly and monthly study sessions with 10-minute reminders.",
      },
      { property: "og:title", content: "CommitX — Study Planner" },
      {
        property: "og:description",
        content: "Plan daily, weekly and monthly study sessions with 10-minute reminders.",
      },
    ],
  }),
  component: Planner,
});

function Planner() {
  const { plans, hydrated } = usePlans();
  const { goalHours, setGoalHours, hydrated: goalHydrated } = useDailyGoal();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [time, setTime] = useState("18:00");
  const [durationMinutes, setDuration] = useState(60);
  const [repeat, setRepeat] = useState<Repeat>("daily");
  const [weekday, setWeekday] = useState(1);
  const [monthday, setMonthday] = useState(1);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  const sorted = useMemo(
    () => [...plans].sort((a, b) => nextOccurrence(a) - nextOccurrence(b)),
    [plans],
  );

  async function save() {
    if (!subject.trim()) return;
    addPlan({
      subject: subject.trim(),
      time,
      durationMinutes,
      repeat,
      weekday: repeat === "weekly" ? weekday : undefined,
      monthday: repeat === "monthly" ? monthday : undefined,
    });
    const ok = await requestNotificationPermission();
    setPermission(ok ? "granted" : "denied");
    setSubject("");
    setOpen(false);
  }

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Planner</p>
            <h1 className="mt-2 truncate text-3xl font-semibold">Study schedule</h1>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
            aria-label="Add study plan"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-hairline bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Daily study goal</p>
              <p className="text-xs text-muted-foreground">
                Syncs with your daily progress tracker on Home.
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">
              {goalHydrated ? formatGoalHours(goalHours) : "—"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8].map((h) => (
              <button
                key={h}
                onClick={() => setGoalHours(h)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  Math.round(goalHours) === h
                    ? "bg-primary text-primary-foreground"
                    : "border border-hairline bg-background text-foreground"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={async () => {
            const ok = await requestNotificationPermission();
            setPermission(ok ? "granted" : "denied");
          }}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-hairline bg-card p-4 text-left shadow-soft"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
            <Bell className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Reminders 10 minutes before
            </span>
            <span className="block text-xs text-muted-foreground">
              {permission === "granted"
                ? "Notifications enabled."
                : permission === "denied"
                  ? "Blocked — enable notifications in system settings."
                  : "Tap to allow notifications."}
            </span>
          </span>
        </button>

        {hydrated && sorted.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-card p-8 text-center shadow-soft">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No study sessions planned yet. Add your first subject.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => (
              <div
                key={p.id}
                className="animate-fade-up rounded-3xl bg-card p-5 shadow-soft"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">
                      {p.subject}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{repeatLabel(p)}</p>
                  </div>
                  <button
                    onClick={() => removePlan(p.id)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground"
                    aria-label={`Delete ${p.subject}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(p.time)}
                  </span>
                  <span className="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-medium text-primary">
                    {p.durationMinutes} min
                  </span>
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Next ·{" "}
                  {new Date(nextOccurrence(p)).toLocaleString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              New study session
            </p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">Plan your study</h3>

            <label className="mt-5 block text-xs uppercase tracking-wider text-muted-foreground">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Organic Chemistry"
              className="mt-2 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value, 10) || 5))}
                  className="mt-2 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            <label className="mt-4 block text-xs uppercase tracking-wider text-muted-foreground">
              Repeat
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["daily", "weekly", "monthly"] as Repeat[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRepeat(r)}
                  className={`rounded-2xl px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                    repeat === r
                      ? "bg-primary text-primary-foreground"
                      : "border border-hairline bg-background text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {repeat === "weekly" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setWeekday(i)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      weekday === i
                        ? "bg-foreground text-background"
                        : "border border-hairline bg-background text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {repeat === "monthly" && (
              <div className="mt-3">
                <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Day of month
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthday}
                  onChange={(e) =>
                    setMonthday(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="mt-2 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-hairline bg-background px-5 py-3 text-sm font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                Save plan
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
