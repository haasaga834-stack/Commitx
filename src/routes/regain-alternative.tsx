import { createFileRoute } from "@tanstack/react-router";
import { Coins, ShieldCheck, Users, Wallet, Smartphone, CalendarCheck } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { GOOGLE_PLAY_URL, googlePlayBadgeAsset } from "@/lib/app-stores";

const URL = "https://commitx.site/regain-alternative";
const TITLE = "Free Regain Alternative for Studying | CommitX";
const DESCRIPTION =
  "Looking for a Regain alternative? CommitX is a free study app with coin-backed focus sessions, app blocking on Android, shared group timers and no subscription.";

export const Route = createFileRoute("/regain-alternative")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "A free Regain alternative for students — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "A free Regain alternative for students — CommitX" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: URL,
          isPartOf: { "@type": "WebSite", name: "CommitX", url: "https://commitx.site" },
        }),
      },
    ],
  }),
  component: RegainAlternativePage,
});

const ROWS: { label: string; commitx: string; regain: string }[] = [
  { label: "Price", commitx: "Free, no paid tier", regain: "Free plan; Pro subscription on top" },
  { label: "What keeps you focused", commitx: "You stake Cx Coins and lose them if you quit", regain: "Strict Mode holds the session to the full time" },
  { label: "Blocking other apps", commitx: "Verified mode with Focus Shield on Android", regain: "Blocks chosen apps during a session; YouTube channel whitelist" },
  { label: "Group study", commitx: "Up to 20 people on one live shared timer", regain: "Focus groups with a leaderboard" },
  { label: "Planner & stats", commitx: "Planner, history, streaks, Screen Time", regain: "Focus stats with a per-subject breakdown" },
  { label: "Locked behind payment", commitx: "Nothing", regain: "Strict Mode, Pomodoro, Focus Guard, themes and focus sounds" },
];

function RegainAlternativePage() {
  return (
    <InfoPage
        eyebrow="Regain alternative"
        title="A free Regain alternative with nothing behind a paywall"
        intro="Regain blocks distracting apps well and has a huge student community, but the features students want most — Strict Mode, Pomodoro rounds, focus sounds — sit behind a subscription. CommitX is free end to end and puts your own coins on the line, so quitting early actually costs you."
        primaryCta={{ label: "Try CommitX free", to: "/auth" }}
        primaryNote="Works in your browser and as an Android app."
        featuresHeading="Why students switch to CommitX"
        features={[
          { icon: Wallet, title: "Completely free", body: "No subscription, no one-time price, no ads." },
          { icon: Coins, title: "Real stakes", body: "Put 50–500 Cx Coins behind a session and win them back when you finish. Quit and they are gone." },
          { icon: ShieldCheck, title: "Verified focus", body: "Verified mode blocks distracting apps on Android so you cannot just switch away." },
          { icon: Users, title: "Study together", body: "Start a group session for up to twenty people, or join an open Focus Class." },
          { icon: CalendarCheck, title: "Plan your day", body: "Planner, streaks, history and a daily receipt of what you actually did." },
          { icon: Smartphone, title: "See your Screen Time", body: "Check which apps took your time, right inside the app." },
        ]}
        notesHeading="Honest notes"
        notes={[
          "Regain is far more established, with millions of students and a big review base — CommitX is newer and smaller.",
          "Regain's free plan already covers unlimited sessions, app blocking and stats; the paid tier adds Strict Mode, Pomodoro, Focus Guard, themes and sounds.",
          "Regain is on iPhone too; CommitX is on Android and the web, with no iPhone app yet.",
          "Cx Coins are in-app points with no cash value.",
        ]}
        closing={{
          heading: "Ready to make your focus count?",
          body: "Set a session, stake your coins and finish what you start.",
          label: "Start free",
          to: "/auth",
        }}
        related={[
          { label: "How it works", to: "/how-it-works" },
          { label: "Verified focus", to: "/verified-focus" },
          { label: "Group study", to: "/group-study" },
        ]}
        extra={
      <section className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">CommitX vs Regain at a glance</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="p-3"></th>
                <th className="p-3">CommitX</th>
                <th className="p-3">Regain</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="p-3 font-medium text-foreground">{r.label}</td>
                  <td className="p-3 text-foreground">{r.commitx}</td>
                  <td className="p-3 text-muted-foreground">{r.regain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Regain details from its own site and store listings, checked 4 November 2026; prices change, so check Regain's store page for current plans.</p>
        <div className="mt-8 flex justify-center">
          <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer" aria-label="Get CommitX on Google Play">
            <img src={googlePlayBadgeAsset.url} alt="Get it on Google Play" className="h-14 w-auto" />
          </a>
        </div>
      </section>
        }
      />
  );
}
