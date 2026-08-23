import { useState } from "react";
import { Smartphone, Timer } from "lucide-react";
import {
  canChangeScreenTimeLimit,
  formatMinutes,
  markScreenTimeLimitChanged,
  openUsageAccessSettings,
  useScreenTime,
} from "@/lib/native-notifications";

const LIMITS = [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600];

/** Today's screen time for CommitX vs. other apps, with a daily limit picker. */
export function ScreenTimeCard() {
  const { screenTime, updateLimit } = useScreenTime();
  const [locked, setLocked] = useState(() => !canChangeScreenTimeLimit());

  function changeLimit(minutes: number) {
    if (locked) return;
    updateLimit(minutes);
    markScreenTimeLimitChanged();
    setLocked(true);
  }

  // Web build / no native bridge: nothing to show.
  if (!screenTime || !screenTime.supported) return null;

  if (!screenTime.granted) {
    return (
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
            <Smartphone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Screen time</p>
            <p className="text-xs text-muted-foreground">
              CommitX needs Usage Access to read how long your apps were on
              screen today, so it can show your daily totals and warn you when
              you pass your own limit. The data stays on this device and is
              never uploaded.
            </p>

          </div>
        </div>
        <button
          onClick={openUsageAccessSettings}
          className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
        >
          Allow usage access
        </button>
      </div>
    );
  }

  const limit = screenTime.limitMinutes;
  const pct =
    limit > 0 ? Math.min(100, Math.round((screenTime.otherMinutes / limit) * 100)) : 0;
  const over = limit > 0 && screenTime.otherMinutes >= limit;

  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Screen time today</p>
        <Timer className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="mt-4 flex gap-3">
        <div className="flex-1 rounded-2xl bg-secondary/60 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            CommitX
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatMinutes(screenTime.commitxMinutes)}
          </p>
        </div>
        <div className="flex-1 rounded-2xl bg-secondary/60 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Other apps
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatMinutes(screenTime.otherMinutes)}
          </p>
        </div>
      </div>

      {limit > 0 && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={
                "h-full rounded-full transition-all duration-700 " +
                (over ? "bg-destructive" : "bg-primary")
              }
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {over
              ? `Daily limit of ${formatMinutes(limit)} reached.`
              : `${formatMinutes(limit - screenTime.otherMinutes)} left of your ${formatMinutes(limit)} limit.`}
          </p>
        </div>
      )}

      <p className="mt-5 text-[11px] uppercase tracking-widest text-muted-foreground">
        Daily limit
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LIMITS.map((m) => (
          <button
            key={m}
            onClick={() => changeLimit(m)}
            disabled={locked}
            className={
              "rounded-full px-4 py-2 text-xs font-medium transition-colors " +
              (limit === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground") +
              (locked && limit !== m ? " opacity-40" : "")
            }
          >
            {m === 0 ? "Off" : formatMinutes(m)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {locked
          ? "You've already set your limit today — you can change it again tomorrow."
          : "You can change this limit once per day. Resets automatically at midnight, and we notify you once your limit for other apps is reached."}
      </p>
    </div>
  );
}
