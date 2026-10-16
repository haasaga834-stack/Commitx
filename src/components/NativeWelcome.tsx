import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hourglass } from "@/components/Hourglass";
import { cn } from "@/lib/utils";
import { formatDuration, savePrimaryPlan, setDailyGoalHours } from "@/lib/planner";
import { StudyWidgetInvite } from './StudyWidgetInvite';
import { markWidgetInvited, widgetInvitationSeen } from '@/lib/study-widget';

const GOAL_OPTIONS = [1, 2, 3, 4, 6, 8];
const SUBJECTS = ["Maths", "Physics", "Chemistry", "Biology", "Coding", "English", "History", "Economics"];
const DURATIONS = [30, 60, 90, 120];
const TIMES = [
  { label: "Morning", time: "07:00" },
  { label: "Afternoon", time: "14:00" },
  { label: "Evening", time: "18:00" },
  { label: "Night", time: "21:00" },
];

type Step = 0 | 1 | 2 | 3 | 4;

/** Native first-run: welcome, then a short interactive setup of daily goal + next session. */
export function NativeWelcome({ onDone, userId }: { onDone: () => void; userId: string }) {
  const [step, setStep] = useState<Step>(0);
  const [hours, setHours] = useState(2);
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(60);
  const [time, setTime] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);

  const next = () => {
    if (step === 1) {
      setDailyGoalHours(hours);
      if (!widgetInvitationSeen(userId)) {
        markWidgetInvited(userId);
        setWidgetOpen(true);
        return;
      }
    }
    setStep((step + 1) as Step);
  };

  const finish = async () => {
    setSaving(true);
    try {
      setDailyGoalHours(hours);
      await savePrimaryPlan({
        subject: subject.trim(),
        topic: "",
        time,
        durationMinutes: duration,
        repeat: "daily",
        priority: "high",
      });
    } catch {
      /* plan stays local and syncs later */
    }
    onDone();
  };

  if (step === 0) {
    return (
      <section role="dialog" aria-modal="true" aria-labelledby="native-welcome-title"
        className="fixed inset-0 z-50 flex flex-col bg-background px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-foreground animate-in fade-in duration-300 motion-reduce:animate-none">
        <p className="text-center font-display text-sm font-semibold">CommitX</p>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-7 py-8 text-center">
          <Hourglass size={160} state="idle" />
          <div>
            <h1 id="native-welcome-title" className="font-display text-3xl font-semibold leading-tight">
              One promise.<br />Your focus.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Commit. Complete. Get It Back.</p>
          </div>
        </div>
        <Button onClick={() => setStep(1)} className="mx-auto h-12 w-full max-w-sm rounded-full">
          Let’s begin <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    );
  }

  const canNext = step !== 2 || subject.trim().length > 0;
  const meta = {
    1: { icon: Target, title: "How many hours a day?", sub: "Your daily study goal. Change it anytime." },
    2: { icon: BookOpen, title: "What will you study next?", sub: "Pick a subject or type your own." },
    3: { icon: Timer, title: "For how long?", sub: "Length of your next session." },
    4: { icon: Clock, title: "When will you start?", sub: "We’ll remind you before it begins." },
  }[step];
  const Icon = meta.icon;

  if (widgetOpen) return <StudyWidgetInvite userId={userId} onDone={() => { setWidgetOpen(false); setStep(2); }} />;

  const chip = (active: boolean) =>
    cn("h-11 rounded-full border text-sm font-medium transition-all active:scale-95",
      active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-hairline bg-card text-foreground");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm animate-in fade-in duration-200 sm:items-center">
      <section role="dialog" aria-modal="true" aria-labelledby="setup-title" key={step}
        className="w-full max-w-sm rounded-[28px] border border-hairline bg-card p-6 text-foreground shadow-soft animate-in slide-in-from-bottom-6 fade-in duration-300 motion-reduce:animate-none">
        <div className="mb-5 flex items-center justify-center gap-1.5" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary" : "w-1.5 bg-muted")} />
          ))}
        </div>
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><Icon className="h-6 w-6" /></span>
          <h2 id="setup-title" className="mt-3 font-display text-xl font-semibold">{meta.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{meta.sub}</p>
        </div>

        <div className="mt-5">
          {step === 1 && (
            <div className="grid grid-cols-3 gap-2">
              {GOAL_OPTIONS.map((h) => (
                <button key={h} type="button" onClick={() => setHours(h)} className={chip(hours === h)}>{h}h</button>
              ))}
            </div>
          )}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((s) => (
                  <button key={s} type="button" onClick={() => setSubject(s)} className={chip(subject === s)}>{s}</button>
                ))}
              </div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 40))} placeholder="Or type a subject"
                className="mt-3 h-11 rounded-full text-center" />
            </>
          )}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map((d) => (
                <button key={d} type="button" onClick={() => setDuration(d)} className={chip(duration === d)}>{formatDuration(d)}</button>
              ))}
            </div>
          )}
          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {TIMES.map((t) => (
                  <button key={t.time} type="button" onClick={() => setTime(t.time)} className={chip(time === t.time)}>{t.label}</button>
                ))}
              </div>
              <Input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className="mt-3 h-11 rounded-full text-center" />
            </>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={() => setStep((step - 1) as Step)} className="h-12 w-12 shrink-0 rounded-full p-0" aria-label="Back">
            <ArrowLeft />
          </Button>
          {step < 4 ? (
            <Button disabled={!canNext} onClick={next} className="h-12 flex-1 rounded-full">
              Next <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button disabled={saving} onClick={() => void finish()} className="h-12 flex-1 rounded-full">
              {saving ? "Saving…" : <>Set my goal <Check aria-hidden="true" /></>}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
