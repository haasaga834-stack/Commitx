import finisherBadge from "@/assets/challenge-finisher-badge.png";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Flame, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/use-auth";
import { syncStudyWidget } from "@/lib/study-widget";
import { hasNativeBridge } from "@/lib/native-session";
import { useAppState } from "@/lib/commitx-store";
import { addTodo, clearCarryOverTodos, getCarryOverTodos, getTodos } from "@/lib/planner";
import {
  CHALLENGE_DAYS,
  CHALLENGE_DAILY_MINUTES,
  challengeProgress,
  challengeFailRoast,
  challengeRoast,
  endChallenge,
  getChallenge,
  inviteSeenToday,
  markInviteSeen,
  markMorningDone,
  morningDone,
  startChallenge,
} from "@/lib/challenge";

type View = "invite" | "morning" | "result" | null;

/** 21-Day Verified Challenge: invitation, daily morning plan, and result pop-ups. Never changes Home layout. */
export function ChallengePopup({ hidden = false }: { hidden?: boolean }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { state, hydrated } = useAppState();
  const navigate = useNavigate();
  const [view, setView] = useState<View>(null);
  const [record, setRecord] = useState(() => null as ReturnType<typeof getChallenge>);
  const [carry, setCarry] = useState<{ id: string; text: string; keep: boolean }[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    // Wait until onboarding is finished so the invite isn't consumed underneath it.
    if (!uid || !hydrated || hidden || !hasNativeBridge()) return;
    const t = window.setTimeout(() => {
      const rec = getChallenge(uid);
      setRecord(rec);
      if (rec) {
        const p = challengeProgress(rec, state.sessions);
        if (p.status === "failed") return failNow(rec);
        if (p.status !== "active") return setView("result");
        if (!morningDone(uid)) openMorning();
      } else if (!inviteSeenToday(uid)) {
        markInviteSeen(uid);
        setView("invite");
      }
    }, 1500);
    return () => window.clearTimeout(t);
    // Evaluate once per sign-in, not on every session change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, hydrated, hidden]);

  // Let the user reopen the progress card from anywhere.
  useEffect(() => {
    const open = () => uid && (getChallenge(uid) ? (setRecord(getChallenge(uid)), openMorning()) : setView("invite"));
    window.addEventListener("commitx:open-challenge", open);
    return () => window.removeEventListener("commitx:open-challenge", open);
  });

  // A missed day ends the challenge immediately: roast, then it vanishes.
  const [failText, setFailText] = useState<string | null>(null);
  function failNow(rec: NonNullable<ReturnType<typeof getChallenge>>) {
    if (!uid) return;
    setFailText(challengeFailRoast(challengeProgress(rec, state.sessions)));
    endChallenge(uid);
    setRecord(null);
    syncStudyWidget(uid);
    setView("result");
  }
  useEffect(() => {
    if (!uid || !hasNativeBridge()) return;
    const check = () => {
      const rec = getChallenge(uid);
      if (rec && challengeProgress(rec, state.sessions).status === "failed") failNow(rec);
    };
    const id = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", check); };
  });

  function openMorning() {
    const today = getTodos().map((t) => t.text.toLowerCase());
    setCarry(getCarryOverTodos().filter((t) => !today.includes(t.text.toLowerCase())).map((t) => ({ id: t.id, text: t.text, keep: true })));
    setGoals([]);
    setDraft("");
    setView("morning");
  }

  const progress = useMemo(() => (record ? challengeProgress(record, state.sessions) : null), [record, state.sessions]);

  if (!uid || !view) return null;
  const close = () => setView(null);

  function accept() {
    if (!uid) return;
    startChallenge(uid);
    setRecord(getChallenge(uid));
    syncStudyWidget(uid);
    openMorning();
  }

  function commitDay() {
    if (!uid) return;
    const all = [...carry.filter((c) => c.keep).map((c) => c.text), ...goals, draft.trim()].filter(Boolean);
    const existing = new Set(getTodos().map((t) => t.text.toLowerCase()));
    for (const g of all) if (!existing.has(g.toLowerCase())) { addTodo(g); existing.add(g.toLowerCase()); }
    clearCarryOverTodos();
    markMorningDone(uid);
    syncStudyWidget(uid);
    close();
  }

  const pct = progress ? Math.min(100, Math.round((progress.todayMinutes / CHALLENGE_DAILY_MINUTES) * 100)) : 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { if (view === "morning" && uid) markMorningDone(uid); close(); } }}>
      <DialogContent className={`max-h-[85vh] w-[calc(100%-3rem)] overflow-y-auto rounded-3xl text-center ${view === "morning" ? "max-w-sm p-5" : "max-w-[300px] p-5"}`}>
        {view === "invite" && (
          <div className="flex flex-col items-center text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary"><Flame className="h-5 w-5" /></span>
            <DialogTitle className="text-center font-display text-lg">21-Day Challenge</DialogTitle>
            <DialogDescription className="mt-1.5 text-center text-[13px] leading-snug">
              3 Verified hours every day for 21 days. Miss one day and it’s over.
            </DialogDescription>
            <p className="mt-3 text-center text-xs text-muted-foreground">🔥 Widget streak · 📝 Daily plan · 🏅 Badge</p>
            <Button className="mt-4 w-full" onClick={accept}>Accept the challenge</Button>
            <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={close}>Maybe later</Button>
          </div>
        )}

        {view === "morning" && progress && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Day {progress.day} of {CHALLENGE_DAYS}</p>
            <DialogTitle className="mt-1 text-center font-display text-xl">What will you finish today?</DialogTitle>
            <DialogDescription className="mt-1 text-center text-sm">{challengeRoast(progress)}</DialogDescription>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.floor(progress.todayMinutes / 60)}h {progress.todayMinutes % 60}m / 3h Verified today
            </p>

            <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Challenge days">
              {Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
                const d = progress.days[i];
                const cls = d?.met ? "bg-primary text-primary-foreground" : d?.frozen ? "bg-secondary text-secondary-foreground" : i + 1 === progress.day ? "border-2 border-primary" : "bg-muted text-muted-foreground";
                return <span key={i} className={`flex aspect-square items-center justify-center rounded-lg text-[11px] font-semibold ${cls}`}>{d?.frozen ? "❄" : i + 1}</span>;
              })}
            </div>

            {carry.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Incomplete from yesterday</p>
                {carry.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCarry((cs) => cs.map((x) => (x.id === c.id ? { ...x, keep: !x.keep } : x)))}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${c.keep ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c.keep && <Check className="h-3.5 w-3.5" />}</span>
                    <span className={c.keep ? "" : "text-muted-foreground line-through"}>{c.text}</span>
                  </button>
                ))}
              </div>
            )}

            {goals.length > 0 && (
              <ul className="mt-3 space-y-1">
                {goals.map((g, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-1.5 text-sm">
                    {g}
                    <button type="button" aria-label={`Remove ${g}`} onClick={() => setGoals((gs) => gs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}

            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setGoals((g) => [...g, draft.trim()]); setDraft(""); } }}>
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Physics Ch 5 revision" maxLength={120} />
              <Button type="submit" size="icon" variant="secondary" aria-label="Add goal"><Plus className="h-4 w-4" /></Button>
            </form>

            <Button className="mt-4 w-full" size="lg" onClick={commitDay}>Commit to Day {progress.day}</Button>
            <Button variant="ghost" className="mt-1 w-full" onClick={() => { commitDay(); navigate({ to: "/commit" }); }}>
              Commit & start Verified session
            </Button>
          </div>
        )}

        {view === "result" && (progress || failText) && (
          <div className="flex flex-col items-center text-center">
            {!failText && progress?.status === "completed" ? (
              <img src={finisherBadge} alt="21-Day Finisher badge" width={144} height={144} className="mb-3 h-36 w-36 object-contain" />
            ) : (
              <span className="mb-3 text-5xl">💔</span>
            )}
            <DialogTitle className="text-center font-display text-xl">
              {!failText && progress?.status === "completed" ? "21-Day Finisher!" : "Challenge failed"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-center text-sm">
              {!failText && progress?.status === "completed"
                ? "You studied 3 Verified hours a day for 21 days. Absolute beast."
                : failText ?? "You missed the 3-hour Verified target. Start again — this time, no excuses."}
            </DialogDescription>
            <Button className="mt-5 w-full" size="lg" onClick={() => { endChallenge(uid); startChallenge(uid); setFailText(null); setRecord(getChallenge(uid)); syncStudyWidget(uid); openMorning(); }}>
              Start a new 21 days
            </Button>
            <Button variant="ghost" className="mt-1 w-full" onClick={() => { endChallenge(uid); setFailText(null); setRecord(null); close(); }}>Not now</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
