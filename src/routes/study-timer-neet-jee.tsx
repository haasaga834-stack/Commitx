import { createFileRoute } from "@tanstack/react-router";
import {
  Timer,
  Coins,
  ShieldCheck,
  BellOff,
  Users,
  CalendarCheck,
} from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { GOOGLE_PLAY_URL, googlePlayBadgeAsset } from "@/lib/app-stores";
import { coinLabel, COINS_PER_HOUR } from "@/lib/commitx-store";

const URL = "https://commitx.site/study-timer-neet-jee";
const TITLE = "Study Timer for NEET and JEE | CommitX";
const DESCRIPTION =
  "A study timer for NEET and JEE prep: timed 30-minute to 6-hour blocks, Cx Coins you lose if you quit early, and app blocking on Android so the session holds.";

export const Route = createFileRoute("/study-timer-neet-jee")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "A study timer for NEET and JEE aspirants — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "A study timer for NEET and JEE aspirants — CommitX" },
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
  component: StudyTimerNeetJeePage,
});

const STEPS = [
  "Write the day's blocks the night before: two revision blocks, two problem-solving blocks and one analysis block. Exact chapters and question counts, not \"revise physics\".",
  "Open CommitX, pick the first block and set its length — 45 minutes for a revision pass, 2 hours for a problem set, 3 hours when you are sitting a full paper.",
  "Stake your Cx Coins on it. Start at 50; on a block you keep abandoning, stake more so quitting actually stings.",
  "Choose Verified focus and let Focus Shield lock the apps you picked for the length of the block.",
  "Run the block. No pause, no \"five minutes\" — if you have to stop, you end it and lose the stake, which is the feedback that changes behaviour.",
  "Log the block honestly in the planner: what you finished, what you got wrong, and what tomorrow's first block will be.",
  "Repeat for the rest of the day, and once a week sit a full-length paper on one long timer with the apps blocked.",
];

function StudyTimerNeetJeePage() {
  return (
    <InfoPage
      eyebrow="For NEET and JEE aspirants"
      title="A study timer for NEET and JEE that holds you to the session"
      intro="NEET and JEE are not decided by one heroic 14-hour day. They are decided by whether the four, five, six hours you planned actually happened. CommitX is a timer you cannot quietly walk out of: you stake Cx Coins on the block, the distracting apps stay locked, and the clock runs on real time until the block is done."
      primaryCta={{ label: "Try CommitX free", to: "/auth" }}
      primaryNote="Works in your browser and as an Android app."
      featuresHeading="How it works for exam prep"
      features={[
        { icon: Timer, title: "Blocks from 30 minutes to 6 hours", body: "Short revision passes, long problem sets, or a full-length mock paper on one timer. Sessions past two hours freeze once at the halfway mark for a five-minute break." },
        { icon: Coins, title: "Your coins are on the line", body: `Stake 50–500 Cx Coins on a block. Finish and they are back in your wallet, plus ${coinLabel(COINS_PER_HOUR)} for every completed hour. End it early and the stake is gone.` },
        { icon: ShieldCheck, title: "The apps stay shut", body: "Verified focus with Focus Shield on Android keeps the apps you chose blocked for the whole block, so Instagram is not one swipe away during a mock." },
        { icon: BellOff, title: "No pause button", body: "A block ends two ways: you finish it, or you give up and forfeit. That is what makes a study hour on the clock mean a study hour of work." },
        { icon: Users, title: "Study with other aspirants", body: "Run a group timer with up to twenty people, or join an open Focus Class where students are sitting their own blocks right now." },
        { icon: CalendarCheck, title: "Proof you actually did it", body: "Planner, history, streaks, Screen Time and a daily receipt showing the hours you put in and which apps took the rest." },
      ]}
      stepsHeading="A day you can actually repeat"
      steps={STEPS}
      notesHeading="Honest notes"
      notes={[
        "CommitX is on Android and the web — there is no iPhone app yet.",
        "Cx Coins are in-app points with no cash value; nothing is bought or withdrawn. The loss is the point.",
        "App blocking on Android asks for two permissions (usage access and display over other apps) because the system requires them.",
        "Solo focus, the planner and your stats keep working without internet, so a patchy connection never costs you a block.",
        "A timer cannot teach you a concept. It only protects the hours you spend learning one — the analysis after a mock still has to happen.",
      ]}
      closing={{
        heading: "Book tomorrow's blocks tonight",
        body: "Set the lengths, stake your coins, lock the apps and let the clock do the rest.",
        label: "Start free",
        to: "/auth",
      }}
      related={[
        { label: "Focus timer", to: "/focus-timer" },
        { label: "Verified focus", to: "/verified-focus" },
        { label: "Study tracker", to: "/study-tracker" },
        { label: "Group study", to: "/group-study" },
        { label: "Phone-free studying", to: "/stop-using-phone-while-studying" },
      ]}
      extra={
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            Get the Android app
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            The app is what blocks your apps during a block and keeps your planner, streaks and
            stats in one place.
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
