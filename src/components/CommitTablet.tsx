import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DurationWheel } from "@/components/DurationWheel";
import { TabletShell } from "@/components/TabletShell";
import { coinLabel, formatCoins, MIN_COMMIT, MAX_COMMIT } from "@/lib/commitx-store";
import { openDndSettings } from "@/lib/native-session";

export type CommitTabletProps = {
  goals: readonly string[];
  goal: string;
  onGoal: (g: string) => void;
  customGoal: string;
  onCustomGoal: (v: string) => void;

  usePlanDuration: boolean;
  plansHydrated: boolean;
  duration: number;
  pickedDuration: number;
  onPickedDuration: (n: number) => void;
  planSubject: string | null;
  fmtDuration: (m: number) => string;

  value: number;
  /** Guest visitors focus without staking Cx Coins. */
  guest?: boolean;
  onValue: (n: number) => void;
  coinBalance: number;
  hydrated: boolean;
  error: string | null;

  mode: "standard" | "verified";
  onMode: (m: "standard" | "verified") => void;
  confirmVerified: boolean;
  dndReady: boolean;
  dndOn: boolean | null;
  native: boolean;

  starting: boolean;
  onBegin: () => void;

  /** Verified warning sheet, reused verbatim from the mobile screen. */
  overlay?: React.ReactNode;
};

/** Purpose-built tablet layout for New Commitment. Same fields + logic as mobile. */
export function CommitTablet(p: CommitTabletProps) {
  return (
    <TabletShell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-hairline bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              New commitment
            </p>
            <h1 className="truncate font-display text-3xl font-semibold text-foreground lg:text-4xl">
              Make a promise.
            </h1>
          </div>
        </div>
        <p className="hidden shrink-0 text-sm text-muted-foreground sm:block">
          Choose your terms — you'll keep them.
        </p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* LEFT — the form */}
        <div className="grid gap-6">
          <Panel title="Goal">
            <div className="flex flex-wrap gap-2">
              {p.goals.map((g) => (
                <button
                  key={g}
                  onClick={() => p.onGoal(g)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-all",
                    p.goal === g
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-hairline bg-background text-foreground hover:border-muted-foreground/40",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            {p.goal === "Custom" && (
              <input
                value={p.customGoal}
                onChange={(e) => p.onCustomGoal(e.target.value)}
                placeholder="Name your focus"
                className="mt-3 w-full max-w-sm rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            )}
          </Panel>

          <Panel
            title="Duration"
            aside={
              <span className="font-display text-2xl font-semibold text-primary">
                {p.usePlanDuration && !p.plansHydrated
                  ? "\u2026"
                  : p.duration
                    ? p.fmtDuration(p.duration)
                    : "Not set"}
              </span>
            }
          >
            {!p.usePlanDuration ? (
              <div className="max-w-md">
                <DurationWheel value={p.pickedDuration} onChange={p.onPickedDuration} />
              </div>
            ) : p.plansHydrated && !p.duration ? (
              <Link
                to="/planner"
                className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-hairline bg-background px-4 py-3.5"
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
                className="flex items-center justify-between gap-4 rounded-2xl bg-background px-4 py-3.5"
              >
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {p.planSubject ? `From your plan · ${p.planSubject}` : "From your study plan"}
                </span>
                <span className="shrink-0 text-xs font-medium text-primary">Change</span>
              </Link>
            )}

            {p.duration > 120 && (
              <p className="mt-3 rounded-2xl bg-accent/10 px-4 py-3 text-xs text-primary">
                One 5-minute break starts at the halfway point. Your timer stays paused until
                you return and tap YES.
              </p>
            )}
          </Panel>

          <Panel title="Mode">
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                title="Standard"
                subtitle="Flexible focus"
                points={[
                  "App switching allowed with a warning",
                  "Incoming calls allowed",
                  "Timer pauses in background and resumes on return",
                ]}
                selected={p.mode === "standard"}
                onClick={() => p.onMode("standard")}
              />
              <ModeCard
                title="Verified"
                subtitle="Strict accountability"
                points={[
                  "Home, Recents, or app switch fails",
                  "Do Not Disturb required; 60s emergency call grace",
                  "Split-screen fails on Android",
                ]}
                selected={p.mode === "verified"}
                onClick={() => p.onMode("verified")}
              />
            </div>

            {p.mode === "verified" && p.native && (
              <div className="mt-4 rounded-2xl border border-hairline bg-background p-4">
                {p.dndOn === true ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Check className="h-4 w-4" strokeWidth={3} />
                    DND Enabled ✓
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Do Not Disturb is required
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Allow CommitX Do Not Disturb access once — it turns DND on now and
                        off by itself when your session ends.
                      </p>
                    </div>
                    <button
                      onClick={openDndSettings}
                      className="shrink-0 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
                    >
                      Enable Do Not Disturb
                    </button>
                  </div>
                )}
              </div>
            )}

            {p.mode === "verified" && p.confirmVerified && p.dndReady && (
              <p className="mt-4 rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-foreground">
                Verified rules accepted{p.native ? " · DND Enabled ✓" : ""}. Tap Commit
                Now to begin.
              </p>
            )}
          </Panel>
        </div>

        {/* RIGHT — value + summary + action */}
        <div className="grid gap-6 lg:sticky lg:top-10">
          {p.guest ? (
            <Panel title="No coins needed">
              <p className="text-xs text-muted-foreground">
                You're focusing as a guest — nothing is staked and this session isn't
                saved.{" "}
                <Link to="/auth" className="font-medium text-primary">
                  Sign in
                </Link>{" "}
                to keep your streaks, history and Cx Coins.
              </p>
            </Panel>
          ) : (
          <Panel
            title="Commitment value"
            aside={
              <span className="text-[11px] text-muted-foreground">
                {formatCoins(MIN_COMMIT)} – {coinLabel(MAX_COMMIT)}
              </span>
            }
          >
            <div className="flex items-center rounded-2xl border border-hairline bg-background px-4 py-3">
              <span className="text-xs font-semibold text-muted-foreground">Cx</span>
              <input
                type="number"
                min={MIN_COMMIT}
                max={MAX_COMMIT}
                value={p.value}
                onChange={(e) => p.onValue(Number(e.target.value) || 0)}
                className="ml-2 w-full bg-transparent text-lg font-medium outline-none"
              />
            </div>
            <input
              type="range"
              min={MIN_COMMIT}
              max={MAX_COMMIT}
              step={10}
              value={p.value}
              onChange={(e) => p.onValue(Number(e.target.value))}
              className="mt-4 w-full accent-[color:var(--color-primary)]"
            />
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-xs">
              <span className="text-muted-foreground">Your Cx Coins</span>
              <span className="tabular-nums">
                {p.hydrated ? coinLabel(p.coinBalance) : "—"}
              </span>
            </div>
          </Panel>
          )}

          <Panel title="Summary">
            <dl className="grid gap-2 text-sm">
              <Row label="Goal" value={p.goal === "Custom" ? p.customGoal || "Custom" : p.goal} />
              <Row
                label="Duration"
                value={p.duration ? p.fmtDuration(p.duration) : "Not set"}
              />
              {!p.guest && <Row label="Commitment" value={coinLabel(p.value)} />}
              <Row label="Mode" value={p.mode === "verified" ? "Verified" : "Standard"} />
            </dl>

            {p.error && (
              <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {p.error}
              </p>
            )}

            <button
              onClick={p.onBegin}
              disabled={p.starting}
              className="mt-5 block w-full rounded-full bg-primary px-8 py-4 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {p.starting
                ? "Starting…"
                : p.mode === "verified" && !p.confirmVerified
                  ? "Continue"
                  : "Commit Now"}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Cx Coins only · in-app points, no cash value
            </p>
          </Panel>
        </div>
      </div>

      {p.overlay}
    </TabletShell>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-foreground">{value}</dd>
    </div>
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
        "h-full w-full rounded-3xl border p-5 text-left transition-all",
        selected ? "border-primary bg-background shadow-lift" : "border-hairline bg-background",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-hairline",
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {points.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
            {t}
          </li>
        ))}
      </ul>
    </button>
  );
}
