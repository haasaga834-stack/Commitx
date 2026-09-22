import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, BellOff, Clock, PhoneCall, Smartphone, XCircle } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";

const URL = "https://commitx.site/verified-focus";
const TITLE = "Verified Focus — Distraction-Free Study Sessions | CommitX";
const DESCRIPTION =
  "Verified focus is CommitX's strict mode: Do Not Disturb must be on, and leaving the app ends the session. Built for distraction-free study when you need it most.";

export const Route = createFileRoute("/verified-focus")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Verified Focus — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Verified Focus — CommitX" },
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
  component: VerifiedFocusPage,
});

function VerifiedFocusPage() {
  return (
    <InfoPage
      eyebrow="Verified focus"
      title="Verified focus, for when you cannot afford distractions"
      intro="Verified is the stricter of CommitX's two modes. The rules are simple: Do Not Disturb on before you start, and stay in CommitX until the timer is done."
      primaryCta={{ label: "Try a Verified session", to: "/auth" }}
      primaryNote="Standard focus is the relaxed alternative if Verified feels too strict today."
      featuresHeading="The rules of a Verified session"
      features={[
        {
          icon: BellOff,
          title: "Do Not Disturb first",
          body:
            "The session will not start until Do Not Disturb is on, so notifications are quiet from the beginning.",
        },
        {
          icon: XCircle,
          title: "Leaving ends the session",
          body:
            "Switching apps, opening Recents, going Home or moving to another tab fails the session. That is what makes completing one mean something.",
        },
        {
          icon: PhoneCall,
          title: "Room for emergencies",
          body:
            "A short grace window covers a genuine interruption such as a quick call, so a real emergency does not cost you the session.",
        },
        {
          icon: Smartphone,
          title: "Locking your screen is fine",
          body:
            "Screen lock, an automatic screen-off, notifications, volume and brightness never fail a session. The timer keeps running in the background.",
        },
        {
          icon: Clock,
          title: "Timestamp-based timing",
          body:
            "Progress comes from the recorded start time, so reopening the session shows the correct remaining time.",
        },
        {
          icon: ShieldCheck,
          title: "Nothing is monitored",
          body:
            "CommitX only needs to know whether you stayed in the app and whether Do Not Disturb is on. It does not read your screen or your content.",
        },
      ]}
      stepsHeading="Starting a Verified session"
      steps={[
        "Turn on Do Not Disturb.",
        "Set your goal, duration and commitment, then choose Verified.",
        "Swipe to start and stay in CommitX while the timer runs.",
        "Complete the session to get your commitment back in full.",
      ]}
      notesHeading="Good to know"
      notes={[
        "A failed Verified session is logged honestly, with the reason it ended.",
        "Sessions longer than two hours still get the single five-minute halfway break.",
        "Once started, a session keeps running even without an internet connection.",
      ]}
      closing={{
        heading: "See how a strict session feels",
        body: "Start with something short — thirty minutes is enough to feel the difference.",
        label: "Start a session",
        to: "/auth",
      }}
      related={[
        { label: "Standard focus", to: "/standard-focus" },
        { label: "Focus timer", to: "/focus-timer" },
        { label: "How CommitX works", to: "/how-it-works" },
      ]}
    />
  );
}
