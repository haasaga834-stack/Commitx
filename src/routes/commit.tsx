import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAppState,
  coinLabel,
  formatCoins,
  canAfford,
  MIN_COMMIT,
  MAX_COMMIT,
} from "@/lib/commitx-store";
import { canCheckDnd, hasNativeBridge, isDndEnabled, openDndSettings } from "@/lib/native-session";
import { DurationWheel } from "@/components/DurationWheel";
import { CommitTablet } from "@/components/CommitTablet";
import { useIsTablet } from "@/lib/use-tablet";
import { z } from "zod";
import { usePlans, upcomingPlan } from "@/lib/planner";
import { claimActiveDbSession, releaseActiveDbSession } from "@/lib/active-session";
import { clearEndedSession, writeActiveVerifiedSession } from "@/lib/verified-mode";
import { ThemePicker } from "@/components/ThemePicker";
import type { SessionThemeId } from "@/lib/session-themes";
import { actionErrorMessage } from "@/lib/connectivity";
import { useAuth } from "@/lib/use-auth";
import { FocusShieldSetup, type FocusShieldResult } from "@/components/FocusShieldSetup";
import { writeShieldPlan, clearShieldPlan, shieldSupported } from "@/lib/focus-shield";


const commitSearch = z.object({
  /** "1" when arriving from Swipe to Start — duration is preloaded from the plan. */
  plan: z.coerce.number().optional(),
  /** Mode preselected from the public landing page. */
  mode: z.enum(["standard", "verified"]).optional(),
  duration: z.coerce.number().min(25).max(360).optional(),
});

export const Route = createFileRoute("/commit")({
  validateSearch: commitSearch,
  head: () => ({
    meta: [
      { title: "CommitX — New Commitment" },
      { name: "description", content: "Set your goal, duration, value and mode." },
      { property: "og:title", content: "CommitX — New Commitment" },
      { property: "og:description", content: "Set your goal, duration, value and mode." },
    ],
  }),
  component: Commit,
});

const GOALS = ["Study", "Reading", "Work", "Fitness", "Meditation", "Custom"];

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Commit() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const { plan: fromPlan, mode: fromMode, duration: fromDuration } = Route.useSearch();
  const usePlanDuration = fromPlan === 1;
  const { state, hydrated } = useAppState();
  const { user, loading: authLoading } = useAuth();
  // Visitors can focus without an account: no Cx Coins are staked or required.
  const guest = !authLoading && !user;
  const { plans, hydrated: plansHydrated } = usePlans();
  const [goal, setGoal] = useState("Study");
  const [customGoal, setCustomGoal] = useState("");
  const [rawValue, setValue] = useState(MIN_COMMIT);
  const [mode, setMode] = useState<"standard" | "verified">(fromMode ?? "standard");
  const [confirmVerified, setConfirmVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedWarn, setVerifiedWarn] = useState(false);
  const [dndOn, setDndOn] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  // A session may only begin once a theme has been picked and confirmed.
  const [themeOpen, setThemeOpen] = useState(false);
  // Focus Shield (Standard only) — optional, decided once per commitment.
  const [shieldOpen, setShieldOpen] = useState(false);
  const [shieldDecided, setShieldDecided] = useState(false);
  // Focus Shield is only offered where real device-level blocking exists.
  const [shieldAvailable, setShieldAvailable] = useState(false);
  useEffect(() => {
    setShieldAvailable(shieldSupported());
  }, []);

  const [shieldPlan, setShieldPlan] = useState<FocusShieldResult>({
    enabled: false,
    packages: [],
    labels: [],
  });


  // The study plan is the single source of truth for commitment time.
  const nextPlan = useMemo(() => upcomingPlan(plans), [plans]);
  const planDuration = nextPlan?.plan.durationMinutes ?? 0;
  const [pickedDuration, setPickedDuration] = useState(fromDuration ?? 60);
  const duration = usePlanDuration ? planDuration : pickedDuration;


  const native = hasNativeBridge();
  const dndCheckable = canCheckDnd();

  // Verify DND state whenever Verified is in play (and after returning from settings).
  useEffect(() => {
    if (!verifiedWarn && mode !== "verified") return;

    const check = () => setDndOn(isDndEnabled());
    check();
    const id = window.setInterval(check, 1000);
    const onVis = () => check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [verifiedWarn, mode]);

  // On Android we must positively confirm DND. Anything else (unknown, false, or
  // a bridge that can't report it) blocks the Verified session.
  const dndReady = native ? dndOn === true : true;

  const value = guest ? 0 : rawValue;

  const finalGoal = goal === "Custom" ? customGoal.trim() || "Custom" : goal;

  const affordable = useMemo(() => canAfford(value, state.coins), [value, state.coins]);

  /** Validates the terms, then opens Focus Shield (Standard) or the theme selector. */
  function begin() {
    if (starting) return;
    if (!validate()) return;
    if (mode === "verified") {
      const liveDnd = isDndEnabled();
      setDndOn(liveDnd);
      const liveReady = native ? liveDnd === true : true;
      if (!confirmVerified || !liveReady) {
        if (!liveReady) setConfirmVerified(false);
        setVerifiedWarn(true);
        return;
      }
      setThemeOpen(true);
      return;
    }
    // Standard only: offer Focus Shield once, then continue the normal flow.
    if (shieldAvailable && !shieldDecided) {
      setShieldOpen(true);
      return;
    }
    setThemeOpen(true);
  }


  function validate() {
    if (!duration) {
      setError(
        usePlanDuration
          ? "Add a study plan with a time and duration first — your commitment uses it."
          : "Choose a duration first.",
      );
      return false;
    }
    if (guest) {
      setError(null);
      return true;
    }
    if (value < MIN_COMMIT || value > MAX_COMMIT) {
      setError(
        `Commitment must be between ${formatCoins(MIN_COMMIT)} and ${coinLabel(MAX_COMMIT)}.`,
      );
      return false;
    }
    if (!affordable) {
      setError("Not enough Cx Coins for this commitment. Lower the amount and try again.");
      return false;
    }
    setError(null);
    return true;
  }

  /** Starts the session with the confirmed theme. */
  async function startWithTheme(theme: SessionThemeId) {
    if (starting) return;
    if (!validate()) {
      setThemeOpen(false);
      return;
    }
    setStarting(true);
    // Focus Shield is Standard-only; Verified sessions never carry a plan.
    if (mode === "standard" && shieldPlan.enabled && shieldPlan.packages.length) {
      writeShieldPlan(shieldPlan);
    } else {
      clearShieldPlan();
    }
    try {

      // Only one active session per user — the database is the source of truth.
      const claim = await claimActiveDbSession({
        goal: finalGoal,
        duration,
        value,
        mode,
      });
      if (!claim.ok) {
        setError(
          "You already have an active session running. Finish or end it before starting a new one.",
        );
        return;
      }

      // Final DND check immediately before the timer starts.
      if (mode === "verified") {
        const liveDnd = isDndEnabled();
        setDndOn(liveDnd);
        if (native && liveDnd !== true) {
          await releaseActiveDbSession();
          setConfirmVerified(false);
          setVerifiedWarn(true);
          return;
        }
      }

      // Issue the session ticket. /session refuses to run without it, so a
      // back gesture or refresh can never resurrect an ended timer.
      clearEndedSession();
      writeActiveVerifiedSession({
        goal: finalGoal,
        duration,
        value,
        mode,
        startedAt: Date.now(),
        accumulatedMs: 0,
        runningSince: Date.now(),
        phase: "focus",
        breakStartedAt: null,
        confirmSince: null,
        breaksTaken: 0,
        nonFocusMs: 0,
        theme,
      });

      navigate({
        to: "/session",
        search: {
          goal: finalGoal,
          duration: String(duration),
          value: String(value),
          mode,
          theme,
        } as Record<string, string>,
      });
    } catch (e) {
      setError(actionErrorMessage(e, "Could not start the commitment."));
    } finally {
      setStarting(false);
      setThemeOpen(false);
    }
  }



  function clampValue(next: number) {
    const n = Math.round(next);
    if (Number.isNaN(n)) return;
    setValue(Math.min(MAX_COMMIT, Math.max(MIN_COMMIT, n)));
    setError(null);
  }

  /* Verified session warning + DND gate — shared by both layouts. */
  const overlay = verifiedWarn ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-4xl bg-card p-6 pb-10 shadow-lift sm:rounded-4xl sm:pb-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold">
          Before you start a Verified session
        </h2>
        <p className="mt-2 text-sm text-foreground">
          Verified Session requires you to stay inside CommitX. You cannot leave the app,
          switch to another app, or use the Back button during the session.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {[
            "You cannot leave the app — Home, Recents or switching apps fails the session immediately.",
            "The Back button is disabled while the session is running.",
            "Do Not Disturb must stay on; emergency calls have a 60 second grace window.",
            "Sessions longer than two hours pause once for a 5-minute break at the halfway point.",
            "Your committed amount is returned only when you finish.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-2xl border border-hairline bg-background p-4">
          {!native ? (
            <p className="text-xs text-muted-foreground">
              Do Not Disturb is enforced in the CommitX Android app.
            </p>
          ) : dndOn === true ? (
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <Check className="h-4 w-4" strokeWidth={3} />
              DND Enabled ✓
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                DND is required for Verified Mode. Please enable it in Settings.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Turn it on, then come back — we'll re-check it automatically.
              </p>
              <button
                onClick={openDndSettings}
                className="mt-3 w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                Open Settings
              </button>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setVerifiedWarn(false);
              setMode("standard");
              setConfirmVerified(false);
            }}
            className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
          >
            Cancel
          </button>
          <button
            disabled={!dndReady}
            onClick={() => {
              setConfirmVerified(true);
              setVerifiedWarn(false);
            }}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const picker = (
    <>
      <FocusShieldSetup
        open={shieldOpen}
        durationLabel={duration ? fmtDuration(duration) : "Not set"}
        onCancel={() => setShieldOpen(false)}
        onDone={(result) => {
          setShieldPlan(result);
          setShieldDecided(true);
          setShieldOpen(false);
          setThemeOpen(true);
        }}
      />
      <ThemePicker
        open={themeOpen}
        starting={starting}
        onCancel={() => setThemeOpen(false)}
        onConfirm={(theme) => void startWithTheme(theme)}
      />
    </>
  );


  if (isTablet) {
    return (
      <CommitTablet
        goals={GOALS}
        goal={goal}
        onGoal={setGoal}
        customGoal={customGoal}
        onCustomGoal={setCustomGoal}
        usePlanDuration={usePlanDuration}
        plansHydrated={plansHydrated}
        duration={duration}
        pickedDuration={pickedDuration}
        onPickedDuration={setPickedDuration}
        planSubject={nextPlan?.plan.subject ?? null}
        fmtDuration={fmtDuration}
        value={value}
        onValue={clampValue}
        guest={guest}
        coinBalance={state.coins}
        hydrated={hydrated}
        error={error}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setConfirmVerified(false);
          setShieldDecided(false);
          setShieldPlan({ enabled: false, packages: [], labels: [] });
          if (m === "verified") setVerifiedWarn(true);
        }}

        confirmVerified={confirmVerified}
        dndReady={dndReady}
        dndOn={dndOn}
        native={native}
        starting={starting}
        onBegin={begin}
        overlay={
          <>
            {overlay}
            {picker}
          </>
        }
      />
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-md px-6 pt-14">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            New commitment
          </p>
          <div className="w-10" />
        </div>

        <h1 className="mt-8 text-3xl font-semibold">Make a promise.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your terms — you'll keep them.
        </p>

        {/* Goal */}
        <section className="mt-8">
          <Label>Goal</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-all",
                  goal === g
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-hairline bg-card text-foreground hover:border-muted-foreground/40",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          {goal === "Custom" && (
            <input
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="Name your focus"
              className="mt-3 w-full rounded-2xl border border-hairline bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          )}
        </section>

        {/* Duration — preloaded from the plan when swiped, otherwise chosen here */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <Label>Duration</Label>
            <span className="font-display text-2xl font-semibold text-primary">
              {usePlanDuration && !plansHydrated
                ? "\u2026"
                : duration
                  ? fmtDuration(duration)
                  : "Not set"}
            </span>
          </div>

          {!usePlanDuration ? (
            <DurationWheel value={pickedDuration} onChange={setPickedDuration} />
          ) : plansHydrated && !duration ? (
            <Link
              to="/planner"
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-hairline bg-card px-4 py-3.5"
            >
              <span className="text-xs leading-relaxed text-muted-foreground">
                No study plan yet. Add one with a time and duration and your
                commitment will use it automatically.
              </span>
              <span className="shrink-0 text-xs font-medium text-primary">Open Planner</span>
            </Link>
          ) : (
            <Link
              to="/planner"
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-soft"
            >
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {nextPlan
                  ? `From your plan · ${nextPlan.plan.subject}`
                  : "From your study plan"}
              </span>
              <span className="shrink-0 text-xs font-medium text-primary">Change</span>
            </Link>
          )}

          {duration > 120 && (
            <p className="mt-3 rounded-2xl bg-accent/10 px-4 py-3 text-xs text-primary">
              This session includes one 5-minute break at the halfway point. Your focus timer
              pauses until you return and tap YES.
            </p>
          )}
        </section>


        {/* Value — signed-in only; guests focus without staking coins */}
        {guest ? (
          <section className="mt-8">
            <div className="rounded-2xl bg-card px-4 py-3.5 shadow-soft">
              <p className="text-sm font-medium text-foreground">No coins needed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You're focusing as a guest — nothing is staked and this session isn't saved.{" "}
                <Link to="/auth" className="font-medium text-primary">
                  Sign in
                </Link>{" "}
                to keep your streaks, history and Cx Coins.
              </p>
            </div>
            {error && (
              <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </section>
        ) : (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <Label>Commitment</Label>
            <span className="text-[11px] text-muted-foreground">
              {formatCoins(MIN_COMMIT)} – {coinLabel(MAX_COMMIT)}
            </span>
          </div>
          <div className="mt-3 flex items-center rounded-2xl border border-hairline bg-card px-4 py-3">
            <span className="text-xs font-semibold text-muted-foreground">Cx</span>
            <input
              type="number"
              min={MIN_COMMIT}
              max={MAX_COMMIT}
              value={value}
              onChange={(e) => clampValue(Number(e.target.value) || 0)}
              className="ml-2 w-full bg-transparent text-lg font-medium outline-none"
            />
          </div>
          <input
            type="range"
            min={MIN_COMMIT}
            max={MAX_COMMIT}
            step={10}
            value={value}
            onChange={(e) => clampValue(Number(e.target.value))}
            className="mt-4 w-full accent-[color:var(--color-primary)]"
          />

          {/* Cx Coin balance preview */}
          <div className="mt-4 rounded-2xl bg-card px-4 py-3 shadow-soft">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Your Cx Coins</span>
              <span className="tabular-nums">
                {hydrated ? coinLabel(state.coins) : "—"}
              </span>
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </section>
        )}

        {/* Mode */}
        <section className="mt-8">
          <Label>Mode</Label>
          <div className="mt-3 space-y-3">
            <ModeCard
              title="Standard"
              subtitle="Flexible focus"
              points={[
                "App switching allowed with a warning",
                "Incoming calls allowed",
                "Timer pauses in background and resumes on return",
              ]}
              selected={mode === "standard"}
              onClick={() => {
                setMode("standard");
                setConfirmVerified(false);
              }}
            />
            <ModeCard
              title="Verified"
              subtitle="Strict accountability"
              points={[
                "Home, Recents, or app switch fails",
                "Do Not Disturb required; 60s emergency call grace",
                "Split-screen fails on Android",
              ]}
              selected={mode === "verified"}
              onClick={() => {
                setMode("verified");
                setConfirmVerified(false);
                setShieldDecided(false);
                setShieldPlan({ enabled: false, packages: [], labels: [] });
                setVerifiedWarn(true);
              }}
            />

          </div>

          {mode === "verified" && native && (
            <div className="mt-4 rounded-2xl border border-hairline bg-card p-4 shadow-soft">
              {dndOn === true ? (
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Check className="h-4 w-4" strokeWidth={3} />
                  DND Enabled ✓
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Do Not Disturb is required
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your Verified session can't start until DND is on. Turn it on, then
                    come back — we re-check automatically.
                  </p>
                  <button
                    onClick={openDndSettings}
                    className="mt-3 w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
                  >
                    Enable Do Not Disturb
                  </button>
                </>
              )}
            </div>
          )}

          {mode === "verified" && confirmVerified && dndReady && (
            <p className="mt-4 rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-foreground">
              Verified rules accepted{native ? " · DND Enabled ✓" : ""}. Tap
              Commit Now to begin.
            </p>
          )}

        </section>

        <button
          onClick={begin}
          disabled={starting}
          className="mt-10 block w-full disabled:opacity-60 rounded-full bg-primary px-8 py-5 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
        >
          {starting
            ? "Starting…"
            : (mode === "verified" && !confirmVerified) ||
                (mode === "standard" && shieldAvailable && !shieldDecided)
              ? "Continue"
              : "Commit Now"}

        </button>
      </div>

      {overlay}
      {picker}
    </div>

  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function ModeCard({
  title,
  subtitle,
  points,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  points: string[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border p-5 text-left transition-all",
        selected
          ? "border-primary bg-card shadow-lift"
          : "border-hairline bg-card shadow-soft",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-lg font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-hairline",
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground/60" />
            {p}
          </li>
        ))}
      </ul>
    </button>
  );
}
