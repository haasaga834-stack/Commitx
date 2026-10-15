import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, BellOff, Clock, PhoneCall, Smartphone, XCircle } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";

const URL = "https://commitx.site/verified-focus";
const TITLE = "Verified Focus — Distraction-Free Study Sessions | CommitX";
const DESCRIPTION =
  "Study without distractions with CommitX Verified Focus. Android Focus Shield blocks selected apps until your timer ends; website sessions require you to stay in CommitX.";

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
      intro="Verified is the stricter of CommitX's two modes. On Android, required Focus Shield blocks distracting apps until your study timer ends. On the website, leaving CommitX ends the session instead — the website does not block apps."
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
           title: "App blocking on Android",
          body:
             "Focus Shield is required before an Android Verified session. Recognized social media apps and games are selected by default and cannot be deselected; you choose any extra apps to block. Blocking lasts until the committed duration expires.",
        },
        {
          icon: PhoneCall,
           title: "Emergency access stays available",
          body:
             "On Android, calls and unblocked apps remain available, and switching apps does not fail your session. Website Verified sessions use strict leave-fails rules, with a short grace window for genuine interruptions such as a quick call.",
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
           title: "Permissions, not screen monitoring",
          body:
             "Android Focus Shield uses usage access to detect a selected app and display-over-other-apps permission to show a blocking reminder. It does not read your screen or content. The website checks whether you leave CommitX; it cannot block other apps.",
        },
      ]}
      stepsHeading="Starting a Verified session"
      steps={[
        "Turn on Do Not Disturb.",
         "Set your goal, duration and commitment, then choose Verified. On Android, enable Focus Shield and choose any extra apps to block before selecting your theme.",
         "Swipe to start. Android blocks selected apps while the timer runs; on the website, stay in CommitX until it ends.",
        "Complete the session to get your commitment back in full.",
      ]}
      notesHeading="Good to know"
      notes={[
         "Android Verified sessions have no in-app cancel or pause. Blocking ends automatically when the committed duration expires, but Android-level actions such as revoking permissions or force-stopping the app can bypass protection.",
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
