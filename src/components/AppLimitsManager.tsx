import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Timer, Trash2, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/native-notifications";
import { shieldApps, requestShieldOverlayAccess, openUsageAccess, shieldHasUsageAccess, shieldHasOverlayAccess, type ShieldAppOption } from "@/lib/focus-shield";
import {
  appLimitsReady,
  readAppLimits,
  reelsSupported,
  reelsToMinutes,
  removeAppLimit,
  setAppLimit,
  REELS_LIMIT_OPTIONS,
  TIME_LIMIT_OPTIONS,
  type AppLimit,
} from "@/lib/app-limits";

type View = "list" | "pick" | "configure";

/**
 * Daily per-app usage limits. Enforcement (50% notification, 100% block until
 * midnight) runs natively; this dialog only manages the limit list.
 */
export function AppLimitsManager({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [view, setView] = useState<View>("list");
  const [limits, setLimits] = useState<AppLimit[]>([]);
  const [apps, setApps] = useState<ShieldAppOption[]>([]);
  const [picked, setPicked] = useState<ShieldAppOption | null>(null);
  const [type, setType] = useState<"time" | "reels">("time");
  const [value, setValue] = useState<number>(60);
  const [ready, setReady] = useState(appLimitsReady());

  const refresh = () => setLimits(readAppLimits());

  useEffect(() => {
    refresh();
    setApps(shieldApps());
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Strict permission gate: re-check whenever the app regains focus or
  // visibility (returning from Android settings), and poll while the gate is
  // showing, so a fresh grant is picked up without a manual tap. The list,
  // picker and configure views are unreachable until both permissions hold.
  useEffect(() => {
    const check = () => setReady(appLimitsReady());
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const id = ready ? null : window.setInterval(check, 1_500);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      if (id !== null) window.clearInterval(id);
    };
  }, [ready]);

  const limitedPkgs = useMemo(() => new Set(limits.map((l) => l.pkg)), [limits]);
  const available = useMemo(() => apps.filter((a) => !limitedPkgs.has(a.pkg)), [apps, limitedPkgs]);

  const save = () => {
    if (!picked) return;
    // Never write a limit without both permissions confirmed right now.
    if (!appLimitsReady()) {
      setReady(false);
      setPicked(null);
      setView("list");
      return;
    }
    const minutes = type === "reels" ? reelsToMinutes(value) : value;
    setAppLimit(picked.pkg, type, minutes);
    // Confirm the limit actually persisted before showing it as saved.
    if (!readAppLimits().some((l) => l.pkg === picked.pkg)) {
      toast.error("Couldn't save the limit — please try again.");
      return;
    }
    refresh();
    onSaved?.();
    setPicked(null);
    setView("list");
  };

  const remove = (pkg: string) => {
    removeAppLimit(pkg);
    refresh();
    onSaved?.();
  };

  const chip = (active: boolean) =>
    cn(
      "h-10 rounded-full border text-sm font-medium transition-all active:scale-95",
      active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-hairline bg-card text-foreground",
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm animate-in fade-in duration-200 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-limits-title"
        className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-[28px] border border-hairline bg-card p-6 text-foreground shadow-soft animate-in slide-in-from-bottom-6 fade-in duration-300 motion-reduce:animate-none"
      >
        <div className="flex items-center gap-3">
          {view !== "list" ? (
            <button
              type="button"
              onClick={() => setView(view === "configure" ? "pick" : "list")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Timer className="h-4 w-4" />
            </span>
          )}
          <h2 id="app-limits-title" className="font-display text-lg font-semibold">
            {view === "list" ? "App Limits" : view === "pick" ? "Choose an app" : picked?.label}
          </h2>
        </div>

        {!ready ? (
          <div className="mt-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              App limits need Usage Access and "Display over other apps" so CommitX can see usage
              and cover an app once its limit is used up. Data stays on this device.
            </p>
            <div className="mt-4 grid gap-2">
              {!shieldHasUsageAccess() && (
                <Button onClick={() => { openUsageAccess(); }} className="h-11 rounded-full">
                  Allow usage access
                </Button>
              )}
              {!shieldHasOverlayAccess() && (
                <Button onClick={() => { requestShieldOverlayAccess(); }} variant="outline" className="h-11 rounded-full">
                  Allow display over apps
                </Button>
              )}
              <Button onClick={() => setReady(appLimitsReady())} variant="ghost" className="h-11 rounded-full">
                I've allowed both
              </Button>
            </div>
          </div>
        ) : view === "list" ? (
          <>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {limits.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No app limits yet. Limit time on distracting apps — CommitX covers them for the
                  rest of the day once the limit is used up.
                </p>
              ) : (
                limits.map((l) => (
                  <div key={l.pkg} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{l.label}</p>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatMinutes(l.usedMinutes)} / {formatMinutes(l.minutes)}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", l.usedMinutes >= l.minutes ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${Math.min(100, (l.usedMinutes / l.minutes) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(l.pkg)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                      aria-label={`Remove ${l.label} limit`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={onClose} className="h-11 flex-1 rounded-full">
                Done
              </Button>
              <Button onClick={() => setView("pick")} className="h-11 flex-1 rounded-full">
                <Plus aria-hidden="true" /> Add limit
              </Button>
            </div>
          </>
        ) : view === "pick" ? (
          <>
            <div className="mt-4 grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto">
              {available.map((a) => (
                <button
                  key={a.pkg}
                  type="button"
                  onClick={() => {
                    setPicked(a);
                    setType("time");
                    setValue(60);
                    setView("configure");
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-hairline bg-background p-3 transition-all active:scale-95"
                >
                  {a.icon ? (
                    <img src={a.icon} alt="" className="h-9 w-9 rounded-xl" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-xs font-semibold">
                      {a.label.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="w-full truncate text-center text-[11px]">{a.label}</span>
                </button>
              ))}
              {available.length === 0 && (
                <p className="col-span-3 py-6 text-center text-sm text-muted-foreground">
                  Every installed app already has a limit.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setType("time"); setValue(60); }} className={chip(type === "time")}>
                  <Timer className="mr-1 inline h-4 w-4" /> Time limit
                </button>
                {reelsSupported(picked?.pkg ?? "") ? (
                  <button type="button" onClick={() => { setType("reels"); setValue(50); }} className={chip(type === "reels")}>
                    <Clapperboard className="mr-1 inline h-4 w-4" /> Reels / Shorts
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {type === "time"
                  ? TIME_LIMIT_OPTIONS.map((m) => (
                      <button key={m} type="button" onClick={() => setValue(m)} className={chip(value === m)}>
                        {formatMinutes(m)}
                      </button>
                    ))
                  : REELS_LIMIT_OPTIONS.map((r) => (
                      <button key={r} type="button" onClick={() => setValue(r)} className={chip(value === r)}>
                        {r} reels
                      </button>
                    ))}
              </div>
              {type === "reels" && (
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Estimated as ~{formatMinutes(reelsToMinutes(value))} of watch time (about 30 seconds per reel).
                </p>
              )}
            </div>
            <Button onClick={save} className="mt-4 h-11 w-full rounded-full">
              Set limit <Check aria-hidden="true" />
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
