import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CommitX" },
      {
        name: "description",
        content:
          "How CommitX collects, uses, stores and protects your information, plus your rights over your data and account deletion.",
      },
      { property: "og:title", content: "Privacy Policy — CommitX" },
      {
        property: "og:description",
        content:
          "What CommitX collects, how it is used, where it is stored, and how to delete your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://commitx.site/privacy-policy" },
    ],
    links: [{ rel: "canonical", href: "https://commitx.site/privacy-policy" }],
  }),
  component: PrivacyPage,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Introduction",
    body: [
      "CommitX is a focus and accountability app that helps you commit to study sessions and follow through on them. This Privacy Policy explains what information we collect, why we collect it, and the choices you have.",
      "By creating an account and using CommitX, you agree to the practices described here.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "We keep data collection to the minimum needed to run the app. We do not sell your data, and we do not use it for advertising profiles.",
    ],
  },
  {
    title: "3. Account information",
    body: [
      "When you sign up we store your email address, your display name and, if you add one, your profile photo. If you sign in with Google, we receive your basic Google profile details (name, email, profile picture) to create your account.",
      "We also store a referral code linked to your account when one is used.",
    ],
  },
  {
    title: "4. App usage information",
    body: [
      "To make the app work we store the things you create inside it: commitments and focus sessions (goal, duration, mode, committed amount, outcome), study plans and to-dos, subjects and exam dates, revision progress, streaks, Cx Coin balance and group study membership.",
      "On Android, optional screen-time features read device usage statistics only after you grant permission. That information stays on your device and is used to show your own limits and totals.",
    ],
  },
  {
    title: "5. How information is used",
    body: [
      "We use your information to create and secure your account, run and settle focus sessions, keep your streaks, stats, analytics and Cx Coin balance accurate, enable group study with people you invite, send the in-app and device reminders you enable, and improve reliability by fixing errors.",
    ],
  },
  {
    title: "6. Data storage",
    body: [
      "Your account data is stored on our managed cloud backend, protected by row-level security rules so that your records are only readable by your own authenticated account.",
      "Some preferences and session state are cached on your device so the app works smoothly and your timer stays accurate if the app restarts.",
    ],
  },
  {
    title: "7. Third-party services",
    body: [
      "CommitX relies on a small number of service providers: our cloud hosting and database provider for accounts and app data, Google for optional Google Sign-In, and Google Fonts for typography. These providers process data only to deliver their service to us.",
      "Our public web pages include Google AdSense, which may set cookies or use device identifiers to show and measure ads. Google acts as an independent controller for that data; you can review and change your ad settings at https://myadcenter.google.com. We never send Google your study data, plans, sessions or Cx Coin balance.",
      "We never sell your personal information, and we do not share your study data with anyone for marketing purposes.",
    ],
  },
  {
    title: "8. Authentication",
    body: [
      "Sign-in is handled by our authentication provider. Passwords are never stored in plain text and are never visible to us. If you use Google Sign-In, Google verifies your identity and we only receive your basic profile information.",
      "Password reset links are sent to your registered email address and expire after a short period.",
    ],
  },
  {
    title: "9. Security",
    body: [
      "Data is transmitted over encrypted connections. Balance-affecting actions — commitments, settlements and group joins — are validated on our servers, not trusted from the app. Access to your records requires a valid session for your account.",
      "No system is perfectly secure, so please keep your password private and sign out on shared devices.",
    ],
  },
  {
    title: "10. Your rights",
    body: [
      "You can view and edit your profile, plans, subjects and preferences at any time inside the app. You can request a copy of your data, or ask us to correct or delete it, by contacting us.",
      "Depending on where you live, you may also have rights to object to or restrict certain processing.",
    ],
  },
  {
    title: "11. Account deletion",
    body: [
      "You can delete your account from Settings. Deleting your account removes your profile, sessions, plans, subjects, balances and Cx Coins. Deletion is permanent and cannot be undone.",
      "Limited records may be retained briefly where required for security or legal reasons, then removed.",
    ],
  },
  {
    title: "12. Children's privacy",
    body: [
      "CommitX is intended for students and users aged 13 and above. We do not knowingly collect information from children under 13. If you believe a child has created an account, contact us and we will remove it.",
      "Younger users should use CommitX with the involvement of a parent or guardian.",
    ],
  },
  {
    title: "13. Changes to this policy",
    body: [
      "CommitX is in active beta, so this policy may be updated as features change. Material changes will be announced inside the app, and the updated policy will always be available on this page.",
    ],
  },
  {
    title: "14. Contact",
    body: [
      "Questions about this policy or your data? Email us at commitx07@gmail.com and we will get back to you.",
    ],
  },
];

function PrivacyPage() {
  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="flex items-center gap-3">
          <Link
            to="/how-it-works"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="min-w-0 truncate font-display text-2xl font-semibold">
            Privacy Policy
          </h1>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Your data stays yours. Your study data is never sold or used for ads.</span>
        </div>

        <div className="mt-6 space-y-3 pb-6 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {SECTIONS.map((s, i) => (
            <section
              key={s.title}
              className="rounded-3xl bg-card p-5 shadow-soft animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <h2 className="text-sm font-semibold text-foreground">{s.title}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p) => (
                  <p key={p} className="text-xs leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <PublicFooter />
    </MobileShell>
  );
}
