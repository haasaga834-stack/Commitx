import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MobileShell } from "@/components/BottomNav";
import { useAppState } from "@/lib/commitx-store";
import {
  useSubjects,
  addSubject,
  removeSubject,
  toggleRevised,
  updateSubject,
  subjectProgress,
  suggestedSubjects,
  countdownLabel,
  daysUntil,
  type Subject,
} from "@/lib/academics";
import {
  usePlans,
  useDailyGoal,
  useWeeklyGoal,
  formatGoalHours,
  formatDuration,
} from "@/lib/planner";
import { analyze, formatHours } from "@/lib/analytics-data";
import {
  GraduationCap,
  Plus,
  Trash2,
  CalendarClock,
  Target,
  CheckCircle2,
  Circle,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/academics")({
  head: () => ({
    meta: [
      { title: "CommitX — Academics" },
      {
        name: "description",
        content:
          "Track subjects, exam countdowns, daily and weekly study targets, subject progress and revision in CommitX.",
      },
      { property: "og:title", content: "CommitX — Academics" },
      {
        property: "og:description",
        content: "Subjects, exam countdowns, study targets and revision tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Academics,
});

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-[20px] border border-hairline bg-card p-4 shadow-soft",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function Academics() {
  const { state, hydrated } = useAppState();
  const { subjects, hydrated: subjectsHydrated } = useSubjects();
  const { plans } = usePlans();
  const { goalHours, setGoalHours } = useDailyGoal();
  const { weeklyHours, setWeeklyHours } = useWeeklyGoal();

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const analytics = useMemo(() => analyze(state.sessions), [state.sessions]);
  const progress = useMemo(
    () => subjectProgress(subjects, state.sessions, plans),
    [subjects, state.sessions, plans],
  );
  const suggestions = useMemo(() => suggestedSubjects(plans, subjects), [plans, subjects]);

  const exams = useMemo(
    () =>
      subjects
        .filter((s): s is Subject & { examDate: string } => Boolean(s.examDate))
        .sort((a, b) => daysUntil(a.examDate) - daysUntil(b.examDate)),
    [subjects],
  );

  const todayMinutes = analytics.week.find((d) => d.isToday)?.minutes ?? 0;
  const dailyTarget = goalHours * 60;
  const weeklyTarget = weeklyHours * 60;
  const maxSubjectMinutes = Math.max(...progress.map((p) => p.completedMinutes), 1);
  const revisedCount = subjects.filter((s) => s.revised).length;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error && e.message ? `Couldn't save: ${e.message}` : "Couldn't save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell>
      <header className="px-5 pb-4 pt-8">
        <Link
          to="/planner"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Planner
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <GraduationCap className="h-6 w-6 text-primary" />
          Academics
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Subjects, exams, targets and revision — built from your real CommitX data.
        </p>
      </header>

      <div className="space-y-4 px-5">
        {error ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        {/* Subjects ------------------------------------------------------- */}
        <Card>
          <CardTitle
            icon={<GraduationCap className="h-4 w-4" />}
            title="Subjects"
            hint="Add the subjects you're studying. Exam date is optional."
          />

          <div className="flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Subject name (e.g. Medicine)"
              className="w-full rounded-2xl border border-hairline bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-hairline bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!name.trim() || busy}
                onClick={() =>
                  run(async () => {
                    await addSubject(name, examDate || undefined);
                    setName("");
                    setExamDate("");
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          {suggestions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] text-muted-foreground">From your planner:</span>
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => addSubject(s))}
                  className="rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  + {s}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {!subjectsHydrated ? null : subjects.length === 0 ? (
              <Empty>No subjects yet. Add one above to start tracking.</Empty>
            ) : (
              subjects.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-2xl border border-hairline px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.examDate ? `Exam ${s.examDate} · ${countdownLabel(s.examDate)}` : "No exam date"}
                    </p>
                  </div>
                  <input
                    type="date"
                    value={s.examDate ?? ""}
                    onChange={(e) =>
                      run(() => updateSubject(s.id, { examDate: e.target.value || undefined }))
                    }
                    className="w-[7.5rem] shrink-0 rounded-xl border border-hairline bg-background px-2 py-1.5 text-[11px] outline-none"
                    aria-label={`Exam date for ${s.name}`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => run(() => removeSubject(s.id))}
                    className="shrink-0 text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Exam countdown ------------------------------------------------- */}
        <Card>
          <CardTitle icon={<CalendarClock className="h-4 w-4" />} title="Exam countdown" />
          {exams.length === 0 ? (
            <Empty>Set an exam date on a subject to see its countdown.</Empty>
          ) : (
            <div className="space-y-2">
              {exams.map((s) => {
                const d = daysUntil(s.examDate);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{s.examDate}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        d < 0
                          ? "bg-muted text-muted-foreground"
                          : d <= 7
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/12 text-primary",
                      )}
                    >
                      {countdownLabel(s.examDate)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Revision ------------------------------------------------------- */}
        <Card>
          <CardTitle
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Revision tracking"
            hint={
              subjects.length
                ? `${revisedCount} of ${subjects.length} subject${subjects.length === 1 ? "" : "s"} revised`
                : undefined
            }
          />
          {subjects.length === 0 ? (
            <Empty>Add subjects to track what you've revised.</Empty>
          ) : (
            <div className="space-y-2">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => run(() => toggleRevised(s.id))}
                  className="flex w-full items-center gap-3 rounded-2xl border border-hairline px-3 py-2.5 text-left"
                >
                  {s.revised ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        s.revised ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      {s.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.revised && s.revisedAt
                        ? `Revised ${new Date(s.revisedAt).toLocaleDateString()}`
                        : "Not revised yet"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MobileShell>
  );
}
