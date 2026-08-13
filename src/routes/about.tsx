import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CommitX — Turning Discipline Into Impact" },
      {
        name: "description",
        content:
          "CommitX turns study commitments into real accountability, and completed focus hours into Food Coins for real-world meals.",
      },
      { property: "og:title", content: "About CommitX" },
      {
        property: "og:description",
        content: "Why CommitX exists: accountability that turns discipline into impact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-2xl font-semibold">About us</h1>
        </div>

        <div className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-sm leading-relaxed text-muted-foreground">
            CommitX is a calm accountability app for students. You commit to a
            focus session with a value attached — complete it and you get it
            back. Fail it, and that value becomes an act of good instead.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every completed study hour earns one Food Coin. As the community
            grows, Food Coins are transformed into real meals funded by CommitX.
          </p>
          <p className="text-sm font-medium italic text-primary">
            Turning discipline into impact.
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-medium">What we build</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>Standard and Verified focus sessions with a real-time hourglass.</li>
            <li>Study planner, to-dos and daily study goals.</li>
            <li>Insights, streaks and a community study-hours leaderboard.</li>
          </ul>
        </div>
      </div>
    </MobileShell>
  );
}
