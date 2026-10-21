import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "CommitX Updates — Changelog" },
      { name: "description", content: "What's new in CommitX: reliability fixes, new study features and improvements to the Android app and website." },
      { property: "og:title", content: "CommitX Updates" },
      { property: "og:description", content: "What's new in the CommitX Android app and website." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://commitx.site/changelog" },
    ],
    links: [{ rel: "canonical", href: "https://commitx.site/changelog" }],
  }),
  component: Changelog,
});

const RELEASES: { version: string; date: string; items: string[] }[] = [
  {
    version: "1.0.2",
    date: "October 2026",
    items: [
      "Timers recover after app updates, restarts and clock or time-zone changes.",
      "Press back again on Home to exit — no more accidental closes.",
      "Smoother opening screen.",
      "Crash reporting so we can fix problems faster.",
    ],
  },
  {
    version: "1.0.1",
    date: "October 2026",
    items: [
      "Study Buddy with optional live study cam and buddy finder.",
      "Room Pot for Group Study.",
      "App Usage Limits and a study goal home-screen widget.",
      "Smoother Google sign-in that stays inside the app.",
    ],
  },
  {
    version: "1.0.0",
    date: "September 2026",
    items: ["First Android release: Standard and Verified sessions, Focus Shield, Group Study, Cx Coins."],
  },
];

function Changelog() {
  return (
    <MobileShell>
      <div className="px-6 pt-14 pb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-2xl font-semibold">Updates</h1>
        </div>
        <div className="mt-6 space-y-4">
          {RELEASES.map((r) => (
            <section key={r.version} className="rounded-3xl bg-card p-5 shadow-soft">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Version {r.version}</h2>
                <span className="text-xs text-muted-foreground">{r.date}</span>
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {r.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <PublicFooter />
    </MobileShell>
  );
}
