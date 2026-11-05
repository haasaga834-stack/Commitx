import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Flame, BarChart3, Coins, Users, ListChecks, BellRing, Smartphone } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { coinLabel, COINS_PER_HOUR } from "@/lib/commitx-store";

const URL = "https://commitx.site/study-accountability";
const TITLE = "Study Accountability App for Students | CommitX";
const DESCRIPTION =
  "CommitX is a free study accountability app: stake Cx Coins on each focus session, block distracting apps, get roasted when you slack, study with friends and track honest hours.";

export const Route = createFileRoute("/study-accountability")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Study Accountability — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Study Accountability — CommitX" },
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
          isPartOf: {
            "@type": "WebSite",
            name: "CommitX",
            url: "https://commitx.site",
          },
        }),
      },
    ],
  }),
  component: StudyAccountabilityPage,
});

function StudyAccountabilityPage() {
  return (
    <InfoPage
      eyebrow="Study accountability"
      title="The study accountability app that makes quitting cost something"
      intro="Plenty of apps count your minutes. CommitX asks you to commit first — you put Cx Coins behind a session and get them back only when you finish it. Commit. Complete. Get it back."
      primaryCta={{ label: "Create a free account", to: "/auth" }}
      primaryNote="Free to use and runs entirely on Cx Coins, which have no cash value."
      featuresHeading="How CommitX keeps you accountable"
      features={[
        {
          icon: Coins,
          title: "A commitment on every session",
          body:
            "Cx Coins are set aside when you start and returned in full when you complete. Ending early forfeits them, which makes quitting a decision instead of a habit.",
        },
        {
          icon: ShieldCheck,
          title: "Verified focus for strict days",
          body:
            "On the website, Verified sessions fail if you leave the page. In the Android app, Focus Shield blocks the apps you pick until the timer ends.",
        },
        {
          icon: Smartphone,
          title: "Daily app limits",
          body:
            "Set daily limits for apps like Instagram or YouTube on Android. When the limit is used up, CommitX covers the app until midnight. Usage data stays on your phone.",
        },
        {
          icon: BellRing,
          title: "Accountability reminders",
          body:
            "Short, sarcastic roast notifications nudge you when you skip study or quit a session — an accountability partner that never forgets.",
        },
        {
          icon: Flame,
          title: "Streaks you can see",
          body:
            "Complete at least one session a day to grow your streak, with your longest streak kept beside it.",
        },
        {
          icon: BarChart3,
          title: "Honest stats",
          body:
            "Total focus hours, today's minutes, success rate and daily target progress — including the sessions you did not finish.",
        },
        {
          icon: Users,
          title: "Friends and a leaderboard",
          body:
            "Study on a shared timer with up to nineteen others, and see completed sessions update on the leaderboard.",
        },
        {
          icon: ListChecks,
          title: "Planner and subjects",
          body:
            "Plan what you will study, add subjects with exam dates for a countdown, and tick them off as you revise.",
        },
      ]}
      stepsHeading="A day with CommitX"
      steps={[
        "Plan the blocks you want to study.",
        "Commit Cx Coins to a session and choose Standard or Verified focus.",
        "Focus until the timer finishes — no pause button.",
        `Get your commitment back, earn ${coinLabel(COINS_PER_HOUR)} per completed hour, and extend your streak.`,
      ]}
      notesHeading="What we do not claim"
      notes={[
        "CommitX cannot focus for you — it makes the choice to start clearer.",
        "Cx Coins are in-app points only. They cannot be bought, withdrawn or transferred.",
        "Failed and cancelled sessions stay in your history, because honest data is the point.",
      ]}
      closing={{
        heading: "Make your next study block count",
        body: "Commit to one session today and see how it changes the rest of the week.",
        label: "Get started",
        to: "/auth",
      }}
      related={[
        { label: "Focus timer", to: "/focus-timer" },
        { label: "Verified focus", to: "/verified-focus" },
        { label: "Study tracker", to: "/study-tracker" },
        { label: "Stop using your phone while studying", to: "/stop-using-phone-while-studying" },
        { label: "Study with friends online", to: "/study-with-friends-online" },
      ]}
    />
  );
}
