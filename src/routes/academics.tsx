import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MobileShell } from "@/components/BottomNav";
import {
  useSubjects,
  addSubject,
  removeSubject,
  toggleRevised,
  updateSubject,
  suggestedSubjects,
  countdownLabel,
  daysUntil,
  type Subject,
} from "@/lib/academics";
import { usePlans } from "@/lib/planner";
import {
  GraduationCap,
  Plus,
  Trash2,
  CalendarClock,
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
          "Track subjects, exam countdowns and revision in CommitX.",
      },
      { property: "og:title", content: "CommitX — Academics" },
      {
        property: "og:description",
        content: "Subjects, exam countdowns and revision tracking.",
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
  const { subjects, hydrated: subjectsHydrated } = useSubjects();
  const { plans } = usePlans();

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => suggestedSubjects(plans, subjects), [plans, subjects]);

  const ordered = useMemo<Subject[]>(
    () =>
      [...subjects].sort((a, b) => {
        if (a.examDate && b.examDate) return daysUntil(a.examDate) - daysUntil(b.examDate);
        if (a.examDate) return -1;
        if (b.examDate) return 1;
        return a.name.localeCompare(b.name);
      }),
    [subjects],
  );


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
          Subjects, exams and revision — built from your real CommitX data.
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

          {subjectsHydrated && subjects.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-muted/50 px-3 py-3 text-center text-[11px] text-muted-foreground">
              Added subjects appear in Exam countdown and Revision tracking below.
            </p>
          ) : null}

        </Card>

        {/* Exam countdown ------------------------------------------------- */}
        <Card>
          <CardTitle
            icon={<CalendarClock className="h-4 w-4" />}
            title="Exam countdown"
            hint="Set or change an exam date for each subject here."
          />
          {subjects.length === 0 ? (
            <Empty>Add a subject above to see its exam countdown.</Empty>
          ) : (
            <div className="space-y-2">
              {ordered.map((s) => {
                const d = s.examDate ? daysUntil(s.examDate) : null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                      {s.examDate ? (
                        <p className="text-[11px] text-muted-foreground">
                          {s.examDate} ·{" "}
                          <span
                            className={cn(
                              "font-semibold",
                              d !== null && d < 0
                                ? "text-muted-foreground"
                                : d !== null && d <= 7
                                  ? "text-destructive"
                                  : "text-primary",
                            )}
                          >
                            {countdownLabel(s.examDate)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">No exam date yet</p>
                      )}
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
