import { createFileRoute } from "@tanstack/react-router";
import {
  Coins,
  ShieldCheck,
  Users,
  CalendarCheck,
  Smartphone,
  Timer,
} from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { GOOGLE_PLAY_URL, googlePlayBadgeAsset } from "@/lib/app-stores";

const URL = "https://commitx.site/stop-using-phone-while-studying";
const TITLE = "How to Stop Using Your Phone While Studying | CommitX";
const DESCRIPTION =
  "Practical steps for students preparing for NEET, JEE or boards: cut the phone out of your study hours, block distracting apps and study with real stakes.";

export const Route = createFileRoute("/stop-using-phone-while-studying")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "How to stop using your phone while studying — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "How to stop using your phone while studying — CommitX" },
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
  component: StopPhoneStudyingPage,
});

const STEPS = [
  "Name your three biggest trigger apps out loud — usually Instagram, YouTube Shorts, WhatsApp or a game. You cannot beat a habit you have not named.",
  "Make each one expensive to open: log out, move it off the home screen, or hide it in a folder on the last page. Ten extra seconds is enough to break the reflex.",
  "Decide the exact chapter before you sit down. \"Study physics\" is an invitation to drift; \"solve 12 kinematics problems from HC Verma\" is a job.",
  "Study in timed blocks with a real timer — 45 to 50 minutes, then a genuine break. Never sit down with \"I'll study till I'm done\", because the brain negotiates its way out of that.",
  "Put the phone physically out of reach: another room, a drawer, or with a parent. If it is face-down on the desk, you are spending willpower on not looking at it.",
  "Schedule the break instead of stealing it. A fixed 20 minutes of phone after the block means your brain stops bargaining mid-session.",
  "Block the apps at the system level for the session, so willpower is not the only thing holding you.",
  "Study with other people on a shared timer, so skipping is visible to someone besides you.",
  "Track your hours honestly every night. Two hours of real study looks very different from six hours of phone breaks with notes open.",
];

function StopPhoneStudyingPage() {
  return (
    <InfoPage
      eyebrow="For NEET, JEE and boards"
      title="How to stop using your phone while studying"
      intro="You are not lazy — the apps were built by thousands of engineers to keep you scrolling, and a student with willpower alone loses that fight. Here is how to make phone-free studying the default, then how CommitX's coin stakes and app blocking keep you honest."
      primaryCta={{ label: "Try CommitX free", to: "/auth" }}
      primaryNote="Works in your browser and as an Android app."
      featuresHeading="What actually works"
      features={[
        { icon: Timer, title: "Timed blocks, not open-ended sittings", body: "45–50 minutes with a visible countdown, then a real break. A finish line keeps the mind in the room." },
        { icon: Coins, title: "Put something on the line", body: "Stake 50–500 Cx Coins on a session. Finish and they are yours; quit early and they are gone. Suddenly switching to Instagram costs you." },
        { icon: ShieldCheck, title: "Block the apps for the session", body: "Verified mode with Focus Shield on Android keeps the apps you chose locked while the timer runs, so you cannot quietly slide over to them." },
        { icon: Users, title: "Study with company", body: "A group session of up to twenty people on one live shared timer, or join an open Focus Class full of students studying right now." },
        { icon: CalendarCheck, title: "Plan the day the night before", body: "Planner with the subjects and chapters picked out, so morning-you never has to decide what to open." },
        { icon: Smartphone, title: "See where the hours went", body: "Screen Time inside the app shows which apps took your day, and the daily receipt shows what you actually finished." },
      ]}
      stepsHeading="Nine steps you can start tonight"
      steps={STEPS}
      notesHeading="Honest notes"
      notes={[
        "CommitX is on Android and the web — there is no iPhone app yet.",
        "App blocking on Android needs two permissions (usage access and display over other apps) because the system asks for them, not because the app wants them.",
        "Cx Coins are in-app points with no cash value — the loss is the point, not the money.",
        "Solo focus, the planner and your stats keep working without internet, so a patchy connection never costs you a session.",
        "No app can study for you. These tools make the wrong choice harder and the right choice easier — the hours are still yours to fill.",
      ]}
      closing={{
        heading: "Make the next session cost something",
        body: "Set a timer, stake your coins, lock the distracting apps and finish what you started.",
        label: "Start free",
        to: "/auth",
      }}
      related={[
        { label: "How it works", to: "/how-it-works" },
        { label: "Verified focus", to: "/verified-focus" },
        { label: "Focus timer", to: "/focus-timer" },
        { label: "Study tracker", to: "/study-tracker" },
        { label: "Group study", to: "/group-study" },
      ]}
      extra={
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            Get the Android app
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            The app version is what blocks your apps during a session and keeps your streak,
            planner and stats in one place.
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
