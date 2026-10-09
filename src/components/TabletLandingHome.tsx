import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Moon, Sun, Users } from "lucide-react";
import heroImage from "@/assets/landing-hero.jpg";
import { LandingHourglass } from "@/components/LandingHourglass";
import { Button } from "@/components/ui/button";
import { useAppState, stats } from "@/lib/commitx-store";
import { setNativeAtRootScreen } from "@/lib/native-session";

/** Tablet-only presentation; every action uses the existing native app flow. */
export function TabletLandingHome() {
  const { state, hydrated } = useAppState();
  const totals = useMemo(() => stats(state.sessions), [state.sessions]);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setNativeAtRootScreen(true);
    try {
      setDark(localStorage.getItem("commitx.tablet.home.theme") !== "light");
    } catch { /* Keep the reference palette when storage is unavailable. */ }
    return () => setNativeAtRootScreen(false);
  }, []);

  function toggleTheme() {
    setDark((previous) => {
      const next = !previous;
      try { localStorage.setItem("commitx.tablet.home.theme", next ? "dark" : "light"); } catch { /* optional preference */ }
      return next;
    });
  }

  return (
    <div className={`landing-root cx-tablet-home ${dark ? "landing-dark" : ""}`}>
      <img src={heroImage} alt="" aria-hidden className="cx-tablet-home-image" />
      <div className="cx-tablet-home-wash" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1400px] px-8 lg:px-16">
        <header className="cx-tablet-home-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <Link to="/" replace className="min-w-0 text-lg font-semibold">CommitX</Link>
          <nav aria-label="App navigation" className="flex shrink-0 items-center gap-5 lg:gap-8">
            <Link to="/planner" className="text-sm text-muted-foreground hover:text-foreground">Planner</Link>
            <Link to="/analytics" className="text-sm text-muted-foreground hover:text-foreground">Stats</Link>
            <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">Profile</Link>
            <Button variant="ghost" size="icon" className="rounded-full border border-border" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button asChild className="rounded-full px-5"><Link to="/history">My sessions</Link></Button>
          </nav>
        </header>

        <main>
          <section className="cx-tablet-home-hero grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-center gap-6 lg:gap-12">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">Commit. Complete. Get It Back.</p>
              <h1 className="cx-tablet-home-title mt-6 font-medium">For the things you<br />said you'd do.</h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground lg:text-base">Turn “I should” into “I did.” Start with a commitment. Stay focused. Follow through.</p>
              <div className="cx-tablet-home-actions mt-8 flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-full px-5"><Link to="/commit" search={{ mode: "standard" }}>Start a Standard Session <ArrowRight /></Link></Button>
                <Button asChild variant="outline" className="h-12 rounded-full px-5"><Link to="/commit" search={{ mode: "verified" }}>Start a Verified Session <ArrowRight /></Link></Button>
              </div>
              <p className="mt-5 text-[11px] text-muted-foreground">Your sessions are saved to your CommitX account.</p>
            </div>

            <div className="cx-tablet-home-hourglass relative mx-auto flex w-full min-w-0 items-center justify-center">
              <LandingHourglass size={300} className="cx-tablet-home-glass" />
              <span className="cx-tablet-home-badge absolute left-0 top-0">50 min • Anatomy</span>
              <span className="cx-tablet-home-badge absolute right-0 top-1/3">🔥 {hydrated ? totals.streak : "—"} day streak</span>
              <span className="cx-tablet-home-badge absolute bottom-0 left-0">+25 Cx Coins</span>
            </div>
          </section>

          <section aria-label="Group Study" className="cx-tablet-home-group mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border border-border px-7 py-6">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground"><Users className="h-3.5 w-3.5" /> Group Study</p>
              <h2 className="mt-3 text-2xl font-medium lg:text-3xl">Lock in with your people.</h2>
              <p className="mt-3 text-sm text-muted-foreground">One shared timer. Up to 20 of you.</p>
            </div>
            <Button asChild className="h-12 rounded-full px-6"><Link to="/group">Study together <ArrowRight /></Link></Button>
          </section>
          <nav aria-label="More app pages" className="flex flex-wrap justify-center gap-x-8 gap-y-3 py-6 text-sm text-muted-foreground">
            <Link to="/academics">Academics</Link>
            <Link to="/wallet">Cx Coins</Link>
            <Link to="/settings">Settings</Link>
          </nav>
        </main>
      </div>
    </div>
  );
}