import { useEffect, useMemo, useState } from "react";
import { Shield, ShieldCheck, Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FOCUS_SHIELD_GROUPS,
  openUsageAccess,
  requestShieldOverlayAccess,
  shieldApps,
  shieldHasOverlayAccess,
  shieldHasUsageAccess,
  shieldSupported,
  type ShieldAppOption,
} from "@/lib/focus-shield";

type Step = "intro" | "apps" | "permissions" | "ready";

export interface FocusShieldResult {
  enabled: boolean;
  packages: string[];
  labels: string[];
}

/**
 * Optional Focus Shield flow shown after Standard → Continue.
 * Skipping keeps the existing Standard flow untouched.
 */
export function FocusShieldSetup({
  open,
  durationLabel,
  starting,
  onCancel,
  onDone,
}: {
  open: boolean;
  durationLabel: string;
  starting?: boolean;
  onCancel: () => void;
  onDone: (result: FocusShieldResult) => void;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [selected, setSelected] = useState<string[]>([]);
  const [apps, setApps] = useState<ShieldAppOption[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [usage, setUsage] = useState(false);
  const [overlay, setOverlay] = useState(false);

  const supported = shieldSupported();

  useEffect(() => {
    if (!open) {
      setStep("intro");
      setSelected([]);
      setAppSearch("");
      return;
    }
    setApps(shieldApps());
  }, [open]);

  // Re-verify permissions whenever the user comes back from Android settings.
  useEffect(() => {
    if (!open || !supported) return;
    const check = () => {
      setUsage(shieldHasUsageAccess());
      setOverlay(shieldHasOverlayAccess());
    };
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
  }, [open, supported]);

  /** Groups whose packages are actually installed on this device. */
  const groups = useMemo(() => {
    const installed = new Set(apps.map((a) => a.pkg));
    return FOCUS_SHIELD_GROUPS.map((g) => {
      const present = g.packages.filter((p) => installed.has(p));
      const icon = apps.find((a) => present.includes(a.pkg))?.icon;
      return { ...g, present, icon };
    }).filter((g) => g.present.length > 0);
  }, [apps]);

  const groupPackages = useMemo(() => new Set(groups.flatMap((g) => g.present)), [groups]);
  const moreApps = useMemo(() => apps.filter((app) => !groupPackages.has(app.pkg)), [apps, groupPackages]);
  const visibleMoreApps = useMemo(
    () => moreApps.filter((app) => app.label.toLowerCase().includes(appSearch.trim().toLowerCase())),
    [moreApps, appSearch],
  );
  const allPackages = useMemo(() => apps.map((app) => app.pkg), [apps]);
  const selectedLabels = [
    ...groups.filter((g) => g.present.some((p) => selected.includes(p))).map((g) => g.label),
    ...moreApps.filter((app) => selected.includes(app.pkg)).map((app) => app.label),
  ];

  if (!open) return null;

  const permissionsReady = usage && overlay;

  function toggleGroup(present: string[]) {
    setSelected((prev) => {
      const on = present.some((p) => prev.includes(p));
      return on ? prev.filter((p) => !present.includes(p)) : [...prev, ...present];
    });
  }

  function toggleApp(pkg: string) {
    setSelected((prev) => prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]);
  }

  function finish() {
    onDone({ enabled: true, packages: selected, labels: selectedLabels });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className={cn("max-h-[92dvh] w-full max-w-md rounded-t-4xl bg-card p-6 pb-10 shadow-lift sm:rounded-4xl sm:pb-6", step === "apps" ? "flex h-[92dvh] flex-col overflow-hidden" : "overflow-y-auto")}>
        {step === "intro" && (
          <>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-primary">
              <Shield className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold">Focus Shield</h2>
            <p className="mt-2 text-sm text-foreground">
              Want to block distracting apps during this commitment?
            </p>
            {!supported ? (
              <p className="mt-4 rounded-2xl border border-hairline bg-background p-4 text-xs text-muted-foreground">
                App blocking works in the CommitX Android app. On the web your session runs
                normally — nothing on this device is blocked.
              </p>
            ) : (
              <p className="mt-4 rounded-2xl border border-hairline bg-background p-4 text-xs text-muted-foreground">
                Your apps stay installed and visible. While the session runs, opening a
                blocked app shows a CommitX reminder instead. Access is restored
                automatically the moment the session ends.
              </p>
            )}
            <div className="mt-6 space-y-3">
              <button
                disabled={!supported}
                onClick={() => setStep("apps")}
                className="w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Turn On Focus Shield
              </button>
              <button
                onClick={() => onDone({ enabled: false, packages: [], labels: [] })}
                className="w-full rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground"
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === "apps" && (
          <>
            <Header title="Choose apps to block" onBack={() => setStep("intro")} />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {apps.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-hairline bg-background p-4 text-xs text-muted-foreground">
                No selectable apps were found on this device.
              </p>
            ) : (
              <>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setSelected(allPackages)}
                    className="rounded-full border border-hairline bg-background px-4 py-2 text-xs font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelected([])}
                    className="rounded-full border border-hairline bg-background px-4 py-2 text-xs font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <ul className="mt-4 space-y-2">
                  {groups.map((g) => {
                    const on = g.present.some((p) => selected.includes(p));
                    return (
                      <li key={g.id}>
                        <button
                          onClick={() => toggleGroup(g.present)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                            on ? "border-primary bg-accent/10" : "border-hairline bg-background",
                          )}
                        >
                          {g.icon ? (
                            <img
                              src={g.icon}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-xl object-contain"
                            />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-semibold">
                              {g.label.slice(0, 1)}
                            </span>
                          )}
                          <span className="flex-1 text-sm font-medium">{g.label}</span>
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full border",
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-hairline",
                            )}
                          >
                            {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {moreApps.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold">More apps</h3>
                    <input
                      type="search"
                      value={appSearch}
                      onChange={(event) => setAppSearch(event.target.value)}
                      placeholder="Search installed apps"
                      aria-label="Search installed apps"
                      className="mt-2 w-full rounded-xl border border-hairline bg-background px-3 py-2 text-sm"
                    />
                    <ul className="mt-3 space-y-2">
                      {visibleMoreApps.map((app) => (
                        <li key={app.pkg}>
                          <button
                            onClick={() => toggleApp(app.pkg)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                              selected.includes(app.pkg) ? "border-primary bg-accent/10" : "border-hairline bg-background",
                            )}
                          >
                            {app.icon ? (
                              <img src={app.icon} alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-semibold">{app.label.slice(0, 1)}</span>
                            )}
                            <span className="flex-1 text-sm font-medium">{app.label}</span>
                            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", selected.includes(app.pkg) ? "border-primary bg-primary text-primary-foreground" : "border-hairline")}>
                              {selected.includes(app.pkg) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            </div>
            <div className="mx-1 mt-3 shrink-0 rounded-3xl border border-hairline bg-background p-3 shadow-lift">
              <p className="mb-2 px-1 text-xs text-muted-foreground">{selected.length} selected</p>
              <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={onCancel}
                className="h-12 rounded-full"
              >
                Cancel
              </Button>
              <Button
                disabled={selected.length === 0}
                onClick={() => setStep(permissionsReady ? "ready" : "permissions")}
                className="h-12 rounded-full"
              >
                Continue
              </Button>
              </div>
            </div>
          </>
        )}

        {step === "permissions" && (
          <>
            <Header title="Two permissions needed" onBack={() => setStep("apps")} />
            <p className="mt-2 text-sm text-muted-foreground">
              Focus Shield can only protect your session with your explicit permission.
              Nothing is blocked until both are granted.
            </p>

            <PermissionRow
              granted={usage}
              title="Usage access"
              why="Lets CommitX see which app just came to the foreground, so it knows when a blocked app is opened. CommitX never reads your content and never uploads this data."
              action="Open Usage Access settings"
              onAction={openUsageAccess}
            />
            <PermissionRow
              granted={overlay}
              title="Display over other apps"
              why="Lets CommitX show the Focus Shield reminder on top of a blocked app instead of letting it open."
              action="Open display permission"
              onAction={requestShieldOverlayAccess}
            />

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => onDone({ enabled: false, packages: [], labels: [] })}
                className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
              >
                Skip Shield
              </button>
              <button
                disabled={!permissionsReady}
                onClick={() => setStep("ready")}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "ready" && (
          <>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold">Focus Shield Ready</h2>
            <dl className="mt-4 space-y-2 rounded-2xl border border-hairline bg-background p-4 text-sm">
              <Row label="Duration" value={durationLabel} />
              <Row label="Mode" value="Standard" />
              <Row label="Focus Shield" value="ON" />
              <Row
                label="Blocked apps"
                value={selectedLabels.join(", ") || "None"}
              />
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep("apps")}
                className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
              >
                Change apps
              </button>
              <button
                disabled={starting}
                onClick={finish}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {starting ? "Starting…" : "Start Commitment"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function PermissionRow({
  granted,
  title,
  why,
  action,
  onAction,
}: {
  granted: boolean;
  title: string;
  why: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-hairline bg-background p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        {granted && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
        {title}
        {granted && <span className="text-xs font-normal text-primary">Granted</span>}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{why}</p>
      {!granted && (
        <button
          onClick={onAction}
          className="mt-3 w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
        >
          {action}
        </button>
      )}
    </div>
  );
}
