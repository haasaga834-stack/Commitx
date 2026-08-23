import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { PublicFooter } from "@/components/PublicFooter";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Coins,
  Flame,
  ListChecks,
  Users,
} from "lucide-react";

const TITLE = "Study Tracker App — Track Study Hours & Streaks | CommitX";
const DESCRIPTION =
  "CommitX is a free study tracker for students: track study hours, daily streaks, subjects and exam countdowns, and stay accountable with commitment-backed focus sessions.";

export const Route = createFileRoute("/study-tracker")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Study Tracker App — CommitX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://commitx.site/study-tracker" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://commitx.site/study-tracker" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "CommitX",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Android, Web",
          description: DESCRIPTION,
          url: "https://commitx.site/study-tracker",
        }),
      },
    ],
  }),
  component: StudyTracker,
});

const features = [
  {
    icon: CalendarClock,
    title: "Track every study session",
    body:
      "Start a focus session with a goal and a duration. CommitX records the minutes you actually studied, so your study log builds itself.",
  },
  {
    icon: BarChart3,
    title: "Study hours and analytics",
    body:
      "See total focus hours, today's minutes, success rate and your daily target progress on one calm analytics screen.",
  },
  {
    icon: Flame,
    title: "Daily streaks",
    body:
      "A streak counts every day you complete at least one session, with your longest streak kept alongside it.",
  },
  {
    icon: ListChecks,
    title: "Subjects, exams and revision",
    body:
      "Add subjects with exam dates to get a countdown, and tick subjects off as you revise them.",
  },
  {
    icon: Users,
    title: "Group study timers",
    body:
      "Study with up to five friends on one shared, synchronised timer so everyone finishes together.",
  },
  {
    icon: Coins,
    title: "Cx Coins for consistency",
    body:
      "Every completed hour of focus earns one Cx Coin — a simple, non-cash reward for showing up.",
  },
];

const steps = [
  "Set your goal, duration and a demo commitment amount.",
  "Choose Standard mode, or Verified mode to block app switching.",
  "Focus while the sand timer runs — with a wellness break every hour.",
  "Complete the session, get your commitment back, and log the hours.",
];

function StudyTracker() {
  return (
    <MobileShell>
      <div className="px-6 pt-14 pb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Study tracker
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">
          A study tracker that actually keeps you accountable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          CommitX tracks your study hours, streaks, subjects and exam countdowns —
          and backs each focus session with a commitment you only get back when you
          finish. Commit. Complete. Get it back.
        </p>

        <Link
          to="/auth"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-soft"
        >
          Start tracking free
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Free to use · runs entirely on virtual demo money
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold">
          What you can track
        </h2>
        <div className="mt-4 space-y-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-hairline bg-card p-5 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-medium">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 font-display text-xl font-semibold">
          How a tracked session works
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li
              key={s}
              className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-primary">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 font-display text-xl font-semibold">
          Why students stick with it
        </h2>
        <div className="mt-4 space-y-2">
          {[
            "Your commitment is on the line, so starting is easier than skipping.",
            "Verified mode fails the session if you leave the app — real focus, not a paused timer.",
            "Screen-time insight stays on your device and is never uploaded.",
          ].map((line) => (
            <div
              key={line}
              className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{line}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-hairline bg-card p-6 text-center shadow-soft">
          <h2 className="font-display text-lg font-semibold">
            Ready to see your study hours add up?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a free account and log your first tracked session today.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-[20px] bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            Want the details first?{" "}
            <Link to="/how-it-works" className="text-primary hover:underline">
              See how CommitX works
            </Link>
          </p>
        </div>
      </div>
      <PublicFooter />
    </MobileShell>
  );
}
