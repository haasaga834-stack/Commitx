import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Smartphone, Timer } from "lucide-react";
import { MobileShell } from "@/components/BottomNav";
import { AppLimitsManager } from "@/components/AppLimitsManager";
import { appLimitsAvailable } from "@/lib/app-limits";
import {
  formatMinutes,
  isNativeApp,
  openUsageAccessSettings,
  readScreenTimeDetails,
  type ScreenTimeDetails,
} from "@/lib/native-notifications";

export const Route = createFileRoute("/screen-time")({
  head: () => ({
    meta: [
      { title: "CommitX — Screen Time" },
      { name: "description", content: "Your real daily and weekly screen time, app by app, kept on your device." },
      { property: "og:title", content: "CommitX — Screen Time" },
      { property: "og:description", content: "Your real daily and weekly screen time, app by app, kept on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScreenTimePage,
});

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ScreenTimePage() {
  const [native, setNative] = useState<boolean | null>(null);
  const [data, setData] = useState<ScreenTimeDetails | null>(null);
  const [tab, setTab] = useState<"day" | "week">("day");
  const [limitsOpen, setLimitsOpen] = useState(false);

  const refresh = useCallback(() => setData(readScreenTimeDetails()), []);

  useEffect(() => {
    setNative(isNativeApp());
    refresh();
    const id = window.setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return (
    <MobileShell>
      <div className="px-6 pb-10 pt-14">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-2xl font-semibold">Screen Time</h1>
        </div>

        {native === false || (data && !data.supported) ? (
          <Notice text="Screen Time is available in the CommitX Android app." />
        ) : data && !data.granted ? (
          <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                <Smartphone className="h-4 w-4" />
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                CommitX needs Usage Access to read how long your apps were on screen. The data
                stays on this device and is never uploaded.
              </p>
            </div>
            <button
              onClick={openUsageAccessSettings}
              className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            >
              Allow usage access
            </button>
          </div>
        ) : data ? (
          <Stats data={data} tab={tab} setTab={setTab} />
        ) : null}

        {native && appLimitsAvailable() && (
          <button
            onClick={() => setLimitsOpen(true)}
            className="mt-4 flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.98]"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Timer className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Manage App Limits</span>
              <span className="block text-xs text-muted-foreground">
                Daily time or Reels/Shorts limits per app
              </span>
            </span>
          </button>
        )}
        {limitsOpen && <AppLimitsManager onClose={() => setLimitsOpen(false)} />}
      </div>
    </MobileShell>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-3xl bg-card p-5 text-sm text-muted-foreground shadow-soft">{text}</div>
  );
}

function Stats({
  data,
  tab,
  setTab,
}: {
  data: ScreenTimeDetails;
  tab: "day" | "week";
  setTab: (t: "day" | "week") => void;
}) {
  const weekTotal = data.week.reduce((s, d) => s + d.minutes, 0);
  const weekAvg = data.week.length ? Math.round(weekTotal / data.week.length) : 0;
  const bars =
    tab === "day"
      ? data.hourly.map((m, i) => ({ key: i, value: m, label: i % 6 === 0 ? `${i}h` : "" }))
      : data.week.map((d) => ({
          key: d.dayStart,
          value: d.minutes,
          label: DAY[new Date(d.dayStart).getDay()],
        }));
  const max = Math.max(1, ...bars.map((b) => b.value));
  const topApp = Math.max(1, ...data.apps.map((a) => a.minutes));

  return (
    <>
      <div className="mt-6 flex rounded-full bg-secondary p-1 text-xs font-medium">
        {(["day", "week"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-full py-2 transition-colors " +
              (tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")
            }
          >
            {t === "day" ? "Today" : "This week"}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {tab === "day" ? "Total screen time today" : "Daily average"}
        </p>
        <p className="mt-1 font-display text-3xl font-semibold">
          {formatMinutes(tab === "day" ? data.totalMinutes : weekAvg)}
        </p>
        {tab === "week" && (
          <p className="text-xs text-muted-foreground">{formatMinutes(weekTotal)} in the last 7 days</p>
        )}
        <div className="mt-5 flex h-32 items-end gap-[3px]">
          {bars.map((b) => (
            <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t-md bg-primary"
                style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground">
          {bars.map((b) => (
            <span key={b.key} className="min-w-0 flex-1 text-center">
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Tile label="CommitX" value={data.commitxMinutes} />
        <Tile label="Other apps" value={data.otherMinutes} />
      </div>

      <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">Apps today</p>
      <div className="mt-3 rounded-3xl bg-card p-2 shadow-soft">
        {data.apps.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No app usage recorded yet today.</p>
        ) : (
          data.apps.map((a) => (
            <div key={a.packageName} className="flex items-center gap-3 p-3">
              {a.icon ? (
                <img src={a.icon} alt="" className="h-9 w-9 shrink-0 rounded-xl" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-semibold">
                  {a.label.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{a.label}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatMinutes(a.minutes)}</p>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={"h-full rounded-full " + (a.isCommitX ? "bg-accent" : "bg-primary")}
                    style={{ width: `${(a.minutes / topApp) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Read from Android on this device. Never uploaded.
      </p>
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-2xl bg-card px-4 py-3 shadow-soft">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatMinutes(value)}</p>
    </div>
  );
}
