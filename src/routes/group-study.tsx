import { createFileRoute } from "@tanstack/react-router";
import { Users, Clock, Link2, Bell, UserPlus, Sparkles } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";

const URL = "https://commitx.site/group-study";
const TITLE = "Online Group Study Sessions with a Shared Timer | CommitX";
const DESCRIPTION =
  "Study online with friends on one shared CommitX timer: create a group session, invite up to nineteen others, join late, and finish the session together.";

export const Route = createFileRoute("/group-study")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Online Group Study — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Online Group Study — CommitX" },
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
  component: GroupStudyPage,
});

function GroupStudyPage() {
  return (
    <InfoPage
      eyebrow="Group study"
      title="Study online with friends on one shared timer"
      intro="Group Study lets you lock in with the people you actually study with. One host sets the session, everyone joins the same countdown, and the group finishes together."
      primaryCta={{ label: "Start a group session", to: "/auth" }}
      primaryNote="Group sessions hold up to twenty people: one host and nineteen others."
      featuresHeading="How group sessions work"
      features={[
        {
          icon: Clock,
          title: "One shared clock",
          body:
            "The start and end times live on the server, so every member sees the same remaining time no matter which device or browser they use.",
        },
        {
          icon: Users,
          title: "Up to twenty members",
          body:
            "A host plus nineteen friends, classmates or study partners in the same session.",
        },
        {
          icon: Link2,
          title: "Invite with a code",
          body:
            "Share the session so others can join from their own phone, tablet or laptop.",
        },
        {
          icon: UserPlus,
          title: "Late joining is allowed",
          body:
            "Someone arriving a few minutes in joins the running countdown instead of restarting it. Joining closes once the session has ended.",
        },
        {
          icon: Bell,
          title: "Reliable across reconnects",
          body:
            "Refreshing, backgrounding the app or reconnecting never resets the group timer — it is derived from the shared timestamps.",
        },
        {
          icon: Sparkles,
          title: "Or join a Focus Class",
          body:
            "Prefer studying alongside strangers? Focus Class is an open room with a live count of students focusing right now — no names shared.",
        },
      ]}
      stepsHeading="Getting a group going"
      steps={[
        "One person creates the session with a goal and duration.",
        "Share the invite so the others can join.",
        "Everyone starts on the same countdown.",
        "Finish together — each member's session is recorded on their own account.",
      ]}
      notesHeading="Good to know"
      notes={[
        "Each member keeps their own commitment and result; the timer is what is shared.",
        "Sessions keep running if a member's connection drops.",
        "Focus Class shows only a participant count — never names or personal details.",
      ]}
      closing={{
        heading: "Round up your study group",
        body: "Create a session, send the invite, and start the shared timer.",
        label: "Open CommitX",
        to: "/auth",
      }}
      related={[
        { label: "Focus timer", to: "/focus-timer" },
        { label: "Study accountability", to: "/study-accountability" },
        { label: "Focus Class", to: "/focus-class" },
      ]}
    />
  );
}
