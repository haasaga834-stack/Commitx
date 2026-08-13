import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact CommitX — Support & Feedback" },
      {
        name: "description",
        content:
          "Reach the CommitX team for support, bug reports, partnership or charity-partner enquiries.",
      },
      { property: "og:title", content: "Contact CommitX" },
      {
        property: "og:description",
        content: "Support, feedback and partnership enquiries for CommitX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

function Contact() {
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
          <h1 className="font-display text-2xl font-semibold">Contact us</h1>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Questions, bugs, feature ideas or charity-partner enquiries — we read
          everything and usually reply within two working days.
        </p>

        <a
          href="mailto:support@commitx.app"
          className="mt-6 flex items-center gap-3 rounded-3xl bg-card p-5 shadow-soft"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Email support</span>
            <span className="block truncate text-xs text-muted-foreground">
              support@commitx.app
            </span>
          </span>
        </a>

        <a
          href="mailto:hello@commitx.app"
          className="mt-3 flex items-center gap-3 rounded-3xl bg-card p-5 shadow-soft"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Feedback & partnerships
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              hello@commitx.app
            </span>
          </span>
        </a>
      </div>
    </MobileShell>
  );
}
