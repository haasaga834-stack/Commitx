import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2 } from "lucide-react";
import { planFocusSession, type FocusPlan } from "@/lib/focus-plan.functions";
import { coinLabel, coinsForMinutes } from "@/lib/commitx-store";
import { isOnline } from "@/lib/connectivity";
import { cn } from "@/lib/utils";

const LENGTHS: (number | null)[] = [null, 30, 60, 90, 120, 180];

/** Type a focus goal, get a personalised, achievable session plan from AI. */
export function AiFocusPlan() {
  const plan = useServerFn(planFocusSession);
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FocusPlan | null>(null);

  async function generate() {
    if (busy || goal.trim().length < 3) return;
    if (!isOnline()) {
      setError("You're offline. Connect to the internet to plan with AI.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await plan({ data: { goal: goal.trim(), minutes } });
      if ("error" in res) setError(res.error);
      else setResult(res.plan);
    } catch {
      setError("Could not create a plan. Please sign in and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-primary">
          <Wand2 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Plan a session with AI</p>
          <p className="text-xs text-muted-foreground">Tell us your goal — get a realistic plan.</p>
        </div>
      </div>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value.slice(0, 300))}
        rows={2}
        placeholder="e.g. Finish chapter 4 of organic chemistry and solve 20 problems"
        className="mt-4 w-full resize-none rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {LENGTHS.map((m) => (
          <button
            key={String(m)}
            type="button"
            onClick={() => setMinutes(m)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              minutes === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-hairline text-muted-foreground",
            )}
          >
            {m === null ? "Let AI decide" : m >= 60 ? `${m / 60}h` : `${m}m`}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        onClick={generate}
        disabled={busy || goal.trim().length < 3}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy ? "Planning…" : "Create my plan"}
      </button>

      {result ? (
        <div className="mt-5 rounded-2xl border border-hairline p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-lg font-semibold">{result.title}</p>
            <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium capitalize text-primary">
              {result.mode}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.totalMinutes} min
            {coinsForMinutes(result.totalMinutes) > 0
              ? ` · earns ${coinLabel(coinsForMinutes(result.totalMinutes))}`
              : ""}
          </p>
          <ol className="mt-3 space-y-2">
            {result.blocks.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{b.minutes}m</span>
                <span>{b.task}</span>
              </li>
            ))}
          </ol>
          {result.tip ? <p className="mt-3 text-xs italic text-muted-foreground">{result.tip}</p> : null}
          <Link
            to="/commit"
            search={{ mode: result.mode }}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-primary px-6 py-3 text-sm font-medium text-primary"
          >
            Start this session
          </Link>
        </div>
      ) : null}
    </section>
  );
}
