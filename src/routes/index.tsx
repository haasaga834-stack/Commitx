import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Bell, ClipboardCheck, Leaf, Plus, Sprout, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOME_QUICK_COMMIT_MINUTES } from "@/lib/home-presets";
import homeStudyGroup from "@/assets/home-study-group.png";
import { MobileShell } from "@/components/BottomNav";
import { CxCoin } from "@/components/CxCoin";
import { CxCoinPopup } from "@/components/CxCoinPopup";
import { TabletLandingHome } from "@/components/TabletLandingHome";
import { useIsTablet } from "@/lib/use-tablet";
import { cn } from "@/lib/utils";
import focusMountains from "@/assets/focus-mountains.jpg";

import { useAppState, stats } from "@/lib/commitx-store";
import { Landing } from "@/components/Landing";
import { hasNativeBridge } from "@/lib/native-session";
import { useAuth } from "@/lib/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-cache";
import { dailyMessage } from "@/lib/daily-message";
import {
  usePlans,
  useTodos,
  upcomingPlan,
  formatTime,
  useDailyGoal,
  formatGoalHours,
} from "@/lib/planner";

const HOME_TITLE = "CommitX — Study Focus Timer & Accountability App";
const HOME_DESCRIPTION =
  "Decide. Commit. Complete. Start a Standard or Verified focus session with CommitX — no account required to start.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://commitx.site/" },
      {
        property: "og:image",
        content: "https://commitx.site/commitx-social-preview.jpg?v=20260915",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
      {
        name: "twitter:image",
        content: "https://commitx.site/commitx-social-preview.jpg?v=20260915",
      },
    ],
    links: [{ rel: "canonical", href: "https://commitx.site/" }],
  }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Full-screen startup cover. Rendered by the server on top of the landing
 * page so the very first pixels are always this calm splash — signed-in
 * users never see the public landing page flash before their dashboard.
 */
function StartupSplash({ fading = false }: { fading?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background transition-opacity duration-300",
        fading && "pointer-events-none opacity-0",
      )}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary font-display text-2xl font-semibold text-primary-foreground shadow-lift">
        Cx
      </span>
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
    </div>
  );
}

function Home() {
  const isTablet = useIsTablet();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  // The Android app keeps its existing behaviour: signed-out users go to /auth.
  const native = hasNativeBridge();

  // Gate everything on hydration: the server has no session, so its HTML is
  // "landing + splash cover". The first client render matches it exactly, and
  // only then do we decide between dashboard, landing or /auth.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated || loading || user || !native) return;
    navigate({ to: "/auth" });
  }, [hydrated, loading, user, native, navigate]);

  if (!hydrated) {
    return (
      <>
        <Landing />
        <StartupSplash />
      </>
    );
  }

  // Returning visitors whose session is still being restored keep the splash.
  const restoring = loading && !user && hasStoredAuthSession();
  if (restoring) return <StartupSplash />;

  // The website keeps its own experience for everyone, signed in or not: the
  // app dashboard below belongs to the Android app only.
  if (!native) {
    return (
      <>
        <Landing />
        <StartupSplash fading />
      </>
    );
  }
  if (!user) return <StartupSplash />;

  if (isTablet) return <TabletLandingHome />;
  return <MobileHome />;
}

function MobileHome() {
  const { state, hydrated } = useAppState();
  const s = useMemo(() => stats(state.sessions), [state.sessions]);
  const { plans, hydrated: plansHydrated } = usePlans();
  const { todos } = useTodos();
  const { goalHours } = useDailyGoal();
  const firstName = state.profile.name.split(" ")[0];
  const message = useMemo(() => dailyMessage(), []);

  // Re-evaluate every 30s so scheduled sessions become "next" at the right time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const next = useMemo(() => upcomingPlan(plans, now), [plans, now]);
  const taskCount = plansHydrated ? plans.length + todos.filter((t) => !t.done).length : 0;
  const goalPct = Math.min(100, Math.round((s.todayMinutes / Math.max(1, goalHours * 60)) * 100));
  const goalValue = s.todayMinutes >= 60
    ? `${Math.floor(s.todayMinutes / 60)}h ${s.todayMinutes % 60 ? `${s.todayMinutes % 60}m` : ""}`
    : `${s.todayMinutes}m`;

  return (
    <MobileShell className="cx-phone-home-shell">
      <main className="cx-home mx-auto flex max-w-md flex-col">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1">
          <div className="min-w-0">
            <h1 className="font-display text-base font-medium leading-snug text-foreground">
              <span className="sr-only">CommitX study dashboard — </span>
              {greeting()}
            </h1>
            <p className="truncate font-display text-[22px] font-semibold leading-tight text-foreground">
              {hydrated ? firstName : "\u00A0"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CxCoinPopup coins={state.coins} hydrated={hydrated}>
              <TopChip
                icon={<CxCoin className="h-5 w-5" />}
                value={hydrated ? String(state.coins) : "—"}
                srLabel="Cx Coins"
                clickable
              />
            </CxCoinPopup>
            <Link
              to="/settings"
              hash="notifications"
              aria-label="Notification settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground"
            >
               <Bell className="h-6 w-6" />
            </Link>
          </div>
          <p className="col-span-2 truncate text-xs leading-5 text-muted-foreground">{hydrated ? message : "\u00A0"}</p>
        </header>

        <section className="cx-home-landscape relative flex flex-1 flex-col justify-end overflow-hidden rounded-[24px] border border-hairline bg-card px-5 py-5 shadow-soft">
          <img src={focusMountains} alt="Soft green mountains at sunrise" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="cx-home-image-wash absolute inset-0" />
          <div className="relative z-10">
            {plansHydrated && next && <span className="cx-home-plan mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"><Leaf className="h-4 w-4 shrink-0" /><span className="truncate">{next.plan.subject} · {formatTime(next.plan.time)}</span></span>}
            <h2 className="cx-home-hero-title font-display text-[25px] font-semibold leading-tight">Ready to focus?</h2>
            <Button asChild className="cx-home-start mt-2 h-11 gap-2 rounded-full px-4 text-sm font-semibold">
              <Link to="/commit" search={next ? { plan: 1 } : {}}><Leaf className="h-5 w-5" /> Start Focus Session</Link>
            </Button>
          </div>
        </section>

        <section aria-label="Today at a glance">
          <h2 className="mb-1.5 font-display text-xl font-semibold text-foreground">Today at a Glance</h2>
          <Link to="/planner" className="cx-home-glance flex h-[80px] items-center gap-3 rounded-[20px] border border-hairline bg-card px-3 shadow-soft">
            <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center">
              <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--muted)" strokeWidth="7" />
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${hydrated ? goalPct * 1.696 : 0} 170`} />
              </svg>
              <span className="text-xs font-semibold tabular-nums text-foreground">{hydrated ? `${goalPct}%` : "—"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tabular-nums text-muted-foreground">{hydrated ? goalValue.trim() : "—"} / {formatGoalHours(goalHours)}</p>
               <p className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground"><span className="truncate">{taskCount} {taskCount === 1 ? "task" : "tasks"} planned</span><ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" /></p>
               <p className="text-[10px] leading-4 text-muted-foreground">Stay consistent and keep it simple.</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
          </Link>
        </section>

        <section aria-label="Quick Commit">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold text-foreground">Quick Commit</h2>
            <Link to="/history" className="text-xs text-primary">History</Link>
          </div>
          <div className="cx-home-quick grid grid-cols-[1fr_1fr_1fr_1.05fr] gap-1.5">
            {HOME_QUICK_COMMIT_MINUTES.map((minutes) => (
              <Button asChild key={minutes} variant="outline" className={cn("h-10 gap-1 rounded-full px-1 text-xs font-medium", minutes === 60 && "cx-home-quick-featured")}>
                <Link to="/commit" search={{ duration: minutes }}>{minutes === 60 ? <Sprout className="h-4 w-4" /> : <Leaf className="h-4 w-4" />} {minutes} min</Link>
              </Button>
            ))}
            <Button asChild variant="outline" className="h-10 gap-1 rounded-full px-1 text-xs font-medium"><Link to="/commit">Custom <Plus className="h-3.5 w-3.5" /></Link></Button>
          </div>
        </section>

        <Link to="/group" className="cx-home-group relative flex min-h-[64px] items-center gap-3 overflow-hidden rounded-[20px] border border-hairline bg-card px-3 shadow-soft">
          <img src={homeStudyGroup} alt="" aria-hidden="true" loading="lazy" width={1152} height={576} className="pointer-events-none absolute bottom-0 right-3 h-16 w-28 object-contain opacity-25" />
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Users className="h-5 w-5" /></span>
           <span className="relative min-w-0 flex-1"><span className="block truncate font-display text-lg font-semibold text-foreground">Group Study</span><span className="block truncate text-[11px] text-muted-foreground">Learn together. Stay accountable.</span></span>
           <ArrowRight className="relative h-5 w-5 shrink-0 text-primary" />
        </Link>
      </main>
    </MobileShell>
  );
}

function TopChip({
  icon,
  value,
  srLabel,
  clickable,
}: {
  icon: ReactNode;
  value: string;
  srLabel: string;
  clickable?: boolean;
}) {
  return (
    <div
      className={cn(
        "cx-home-coins flex items-center gap-1.5 rounded-full px-2.5 py-2 shadow-soft",
        clickable && "cursor-pointer transition-transform active:scale-95 hover:shadow-lift",
      )}
      aria-label={srLabel}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {icon}
      <span className="text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

