import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft, Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact CommitX — Support & Feedback" },
      {
        name: "description",
        content:
          "Get in touch with the CommitX team for support, feedback, account questions or partnership enquiries.",
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
      <div className="px-6 pt-14 pb-6">
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

        <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Questions, bugs, account help or partnership ideas — we read every
            message and usually reply within two working days.
          </p>
          <a
            href="mailto:support@commitx.app"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            <Mail className="h-4 w-4" />
            support@commitx.app
          </a>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            For account deletion requests you can also use Settings → Delete
            account, which erases your data immediately.
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
