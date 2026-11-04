import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Clock,
  Link2,
  Sparkles,
  EyeOff,
  Wallet,
} from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { GOOGLE_PLAY_URL, googlePlayBadgeAsset } from "@/lib/app-stores";

const URL = "https://commitx.site/study-with-friends-online";
const TITLE = "Study With Friends Online | CommitX";
const DESCRIPTION =
  "Study with friends online on one shared timer: host a group of up to 20, join an open Focus Class with a live student count, and keep each other honest.";

export const Route = createFileRoute("/study-with-friends-online")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Study with friends online on one shared timer — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Study with friends online on one shared timer — CommitX" },
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
  component: StudyWithFriendsOnlinePage,
});

const STEPS = [
  "Pick the people you actually study with — three to five is enough to make skipping feel rude.",
  "One person creates the group session with the goal and the length, then shares the invite code.",
  "Everyone joins the same countdown from their own phone, tablet or laptop. Late? You join the running clock, it does not restart.",
  "Study with your cameras off and mics quiet. The only thing shared is the timer and who is still in.",
  "Finish together. Each person's session is saved to their own account, with their own coins and stats.",
  "No group yet? Open a Focus Class instead and study next to strangers who are already focusing.",
];

function StudyWithFriendsOnlinePage() {
  return (
    <InfoPage
      eyebrow="Study with friends online"
      title="Study with friends online, on one shared timer"
      intro="Alone, a study session ends the moment it gets boring. With other people on the same clock, quitting early becomes visible — and that changes behaviour. CommitX gives you two ways to do it: your own group on one countdown, or an open Focus Class full of students studying right now."
      primaryCta={{ label: "Start a group session", to: "/auth" }}
      primaryNote="Group sessions hold up to twenty people: one host and nineteen others."
      featuresHeading="Two ways to study together"
      features={[
        { icon: Clock, title: "One shared clock", body: "The start and end times live on the server, so every member sees the same remaining time on any device or browser." },
        { icon: Users, title: "Up to twenty people", body: "A host plus nineteen friends, classmates or study partners in the same session — enough for a batch, a coaching group or a hostel floor." },
        { icon: Link2, title: "Invite and join late", body: "Share the session code and people join from their own device. Arriving a few minutes in puts you on the running countdown, not a fresh one." },
        { icon: Sparkles, title: "Or an open Focus Class", body: "No group to organise: walk into a quiet shared room with a live count of students focusing right now, pick a length and a calm sound, and start." },
        { icon: EyeOff, title: "Quiet by design", body: "No feed, no chat, no names or photos in the Focus Class — just a count of people working. The room is for focus, not for talking." },
        { icon: Wallet, title: "Everyone keeps their own record", body: "Each member holds their own commitment and result. Finish and your coins come back to you; quit early and only you lose yours." },
      ]}
      stepsHeading="Getting a group going"
      steps={STEPS}
      notesHeading="Honest notes"
      notes={[
        "Group sessions and Focus Class need internet — that is the point of a shared clock. Solo focus, the planner and your stats keep working offline.",
        "CommitX is on Android and the web — there is no iPhone app yet, so iPhone friends have to join from the browser.",
        "Focus Class shows only how many students are focusing, never names or personal details.",
        "Cx Coins are in-app points with no cash value — nothing is bought or withdrawn.",
        "You can try a session without an account from the homepage, so you can test the shared timer before signing up.",
      ]}
      closing={{
        heading: "Round up your study group",
        body: "Create a session, send the invite, and start the shared timer — or walk into an open Focus Class.",
        label: "Open CommitX",
        to: "/auth",
      }}
      related={[
        { label: "Group study", to: "/group-study" },
        { label: "Focus Class", to: "/focus-class" },
        { label: "Focus timer", to: "/focus-timer" },
        { label: "Study tracker", to: "/study-tracker" },
        { label: "Phone-free studying", to: "/stop-using-phone-while-studying" },
      ]}
      extra={
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            Get the Android app
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            The app keeps a group session running in your pocket, so the shared clock never
            depends on a browser tab staying open.
          </p>
          <div className="flex justify-center">
            <a
              href={GOOGLE_PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get CommitX on Google Play"
            >
              <img
                src={googlePlayBadgeAsset.url}
                alt="Get it on Google Play"
                className="h-14 w-auto"
              />
            </a>
          </div>
        </section>
      }
    />
  );
}
