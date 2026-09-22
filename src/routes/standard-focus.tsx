import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Clock, Shield, Coffee, Smartphone, Coins } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { coinLabel, COINS_PER_HOUR } from "@/lib/commitx-store";

const URL = "https://commitx.site/standard-focus";
const TITLE = "Standard Focus — Flexible Study Sessions | CommitX";
const DESCRIPTION =
  "Standard focus is CommitX's relaxed mode: the timer runs on real clock time, you can step away when you need to, and Focus Shield can optionally help you stay put.";

export const Route = createFileRoute("/standard-focus")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Standard Focus — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Standard Focus — CommitX" },
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
  component: StandardFocusPage,
});

function StandardFocusPage() {
  return (
    <InfoPage
      eyebrow="Standard focus"
      title="Standard focus — committed, but not rigid"
      intro="Standard is the everyday CommitX mode. You still commit to a block of time, but life is allowed to happen: you can leave the app without the session failing."
      primaryCta={{ label: "Start a Standard session", to: "/auth" }}
      primaryNote="Prefer stricter rules? Verified focus ends the session if you leave the app."
      featuresHeading="What Standard focus gives you"
      features={[
        {
          icon: Sparkles,
          title: "Flexible by design",
          body:
            "Check a message, answer the door, look something up. Standard sessions do not fail because you left the app.",
        },
        {
          icon: Clock,
          title: "Real clock time",
          body:
            "The countdown is based on when you started, so screen-off or app switching never loses progress.",
        },
        {
          icon: Shield,
          title: "Optional Focus Shield",
          body:
            "On Android you can pick apps to keep out of reach during the session. It is optional, Standard-only, and protection is restored when the session ends.",
        },
        {
          icon: Coffee,
          title: "Break on long sessions",
          body:
            "Sessions over two hours freeze once at the halfway mark for five minutes, then continue from exactly where they stopped.",
        },
        {
          icon: Smartphone,
          title: "Works on every screen",
          body:
            "Phone, tablet, laptop — the same session with the same timer, and tapping the timer notification reopens it exactly where it is.",
        },
        {
          icon: Coins,
          title: "Same rewards",
          body:
            `Completing a Standard session returns your commitment and earns ${coinLabel(COINS_PER_HOUR)} for each completed hour, just like Verified.`,
        },
      ]}
      stepsHeading="Starting a Standard session"
      steps={[
        "Pick your goal, duration and commitment.",
        "Choose Standard, and optionally set up Focus Shield.",
        "Swipe to start and get to work.",
        "Finish the session to get your commitment back and log the hours.",
      ]}
      notesHeading="Good to know"
      notes={[
        "Ending a session early through the exit dialog forfeits the commitment — there is no pause.",
        "Focus Shield relies on Android features; on the web CommitX cannot block other apps.",
        "Once started, the session keeps running without an internet connection.",
      ]}
      closing={{
        heading: "Book your next focus block",
        body: "Standard focus is the easiest way to start — commit thirty minutes and see.",
        label: "Start focusing",
        to: "/auth",
      }}
      related={[
        { label: "Verified focus", to: "/verified-focus" },
        { label: "Focus timer", to: "/focus-timer" },
        { label: "Group study", to: "/group-study" },
      ]}
    />
  );
}
