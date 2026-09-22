import { createFileRoute } from "@tanstack/react-router";
import { Clock, Hourglass, Leaf, Coffee, BellOff, Users } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { coinLabel, COINS_PER_HOUR } from "@/lib/commitx-store";

const URL = "https://commitx.site/focus-timer";
const TITLE = "Focus Timer for Studying — Distraction-Free Sessions | CommitX";
const DESCRIPTION =
  "CommitX is a focus timer for studying: pick a goal and a duration, start a distraction-free focus session, and let the timer run on real clock time until you finish.";

export const Route = createFileRoute("/focus-timer")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Focus Timer for Studying — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Focus Timer for Studying — CommitX" },
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
  component: FocusTimerPage,
});

function FocusTimerPage() {
  return (
    <InfoPage
      eyebrow="Focus timer"
      title="A focus timer built for real study sessions"
      intro="CommitX turns the intention to study into a timed commitment. You choose a goal and a duration, start the session, and the timer runs until the time you promised is done."
      primaryCta={{ label: "Start a focus session", to: "/auth" }}
      primaryNote="You can also try a session without signing in from the homepage."
      featuresHeading="What the timer does"
      features={[
        {
          icon: Clock,
          title: "Runs on real clock time",
          body:
            "The countdown is calculated from the moment you started, so a screen turning off or a reopened app never loses or resets your progress.",
        },
        {
          icon: Hourglass,
          title: "30 minutes to 6 hours",
          body:
            "Pick a short revision block or a long deep-work stretch. The sand timer shows how much of your session is left at a glance.",
        },
        {
          icon: Leaf,
          title: "Calm visual scenes",
          body:
            "Five quiet scenes — falling leaves, a growing plant, a firefly garden, a moonlit sky and a lotus pond — move slowly with your progress instead of flashing numbers at you.",
        },
        {
          icon: Coffee,
          title: "One break on long sessions",
          body:
            "Sessions longer than two hours freeze the timer once at the halfway point for a five-minute break, then resume exactly where you stopped.",
        },
        {
          icon: BellOff,
          title: "No pause button",
          body:
            "A session ends two ways: you finish it, or you choose to end it. That is what makes the time you booked feel real.",
        },
        {
          icon: Users,
          title: "Alone or together",
          body:
            "Use the timer on your own, join a shared Group Study timer, or drop into an open Focus Class with other students online.",
        },
      ]}
      stepsHeading="How a session works"
      steps={[
        "Choose what you are working on and how long you want to focus.",
        "Pick Standard focus, or Verified focus for stricter rules.",
        "Choose a scene and start the timer.",
        `Finish the session to get your commitment back and earn ${coinLabel(COINS_PER_HOUR)} for each completed hour.`,
      ]}
      notesHeading="Good to know"
      notes={[
        "Once a session has started it keeps running even if your internet drops.",
        "Every session, finished or not, is saved to your history and stats.",
        "Cx Coins are in-app points with no cash value — nothing is bought or withdrawn.",
      ]}
      closing={{
        heading: "Ready to start the clock?",
        body: "Set a goal, pick a duration, and focus until the timer is done.",
        label: "Start focusing",
        to: "/auth",
      }}
      related={[
        { label: "How CommitX works", to: "/how-it-works" },
        { label: "Study accountability", to: "/study-accountability" },
        { label: "Group study", to: "/group-study" },
      ]}
    />
  );
}
