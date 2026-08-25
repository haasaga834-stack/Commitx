import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CommitX — Turning Discipline Into Impact" },
      {
        name: "description",
        content:
          "CommitX is an accountability app: commit Cx Coins to a focus session, complete it, and get them back. Learn who we are and why we built it.",
      },
      { property: "og:title", content: "About CommitX" },
      {
        property: "og:description",
        content: "Why we built CommitX — turning discipline into impact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://commitx.site/about" },
    ],
    links: [{ rel: "canonical", href: "https://commitx.site/about" }],
  }),
  component: About,
});

function About() {
  return (
    <MobileShell>
      <div className="px-6 pt-14 pb-6">
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

        <div className="mt-6 space-y-4 rounded-3xl bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-soft">
          <p>
            CommitX is a calm accountability app built on one simple idea:
            <span className="text-foreground"> Commit. Complete. Get it back.</span>
          </p>
          <p>
            You commit a small amount to a focus session and choose Standard or
            Verified mode. Finish the session and your commitment returns to your
            wallet. Walk away, and it doesn't.
          </p>
          <p>
            Every completed hour also earns a Cx Coin — a simple reward for
            consistency, which will become redeemable for Cx Coupons as CommitX
            grows.<span className="text-foreground"> Turning discipline into progress.</span>
          </p>
          <p>
            CommitX runs entirely on Cx Coins — in-app points with no cash value,
            used only to back your commitments inside the app.
          </p>
        </div>
      </div>
      <PublicFooter />
    </MobileShell>
  );
}
