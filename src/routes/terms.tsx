import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { ArrowLeft, ScrollText } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — CommitX" },
      {
        name: "description",
        content:
          "The rules for using CommitX: accounts, commitments and sessions, group study, Cx Coins, beta limitations and account termination.",
      },
      { property: "og:title", content: "Terms of Service — CommitX" },
      {
        property: "og:description",
        content:
          "Accounts, commitments, group study, Cx Coins, prohibited use and beta-phase limitations for CommitX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://commitx.site/terms" },
    ],
    links: [{ rel: "canonical", href: "https://commitx.site/terms" }],
  }),
  component: TermsPage,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Acceptance of terms",
    body: [
      "By creating an account or using CommitX, you agree to these Terms of Service. If you do not agree, please stop using the app and delete your account.",
      "CommitX is provided by Aniket Kumar, an independent individual developer (not a company or organisation), reachable at commitx07@gmail.com.",
    ],
  },
  {
    title: "2. Description of CommitX",
    body: [
      "CommitX is a focus and accountability app. You commit to a block of focused time, put Cx Coins behind it, and get those Cx Coins back when you complete the session.",
      "CommitX is not a bank, wallet, payment service, investment product or game of chance. Cx Coins are in-app points only: they cannot be bought, charged for, cashed out or exchanged for anything of value.",
    ],
  },
  {
    title: "3. User accounts",
    body: [
      "You need an account to use CommitX. You must provide accurate information, keep your credentials secure, and are responsible for activity under your account.",
      "One account per person. Creating multiple accounts to farm referral bonuses, coins or streaks is not allowed.",
    ],
  },
  {
    title: "4. User responsibilities",
    body: [
      "Use CommitX for your own study and focus goals. Do not attempt to manipulate balances, timers, streaks, leaderboards or rewards, and do not use the app in a way that breaks the law or harms other users.",
      "Do not use CommitX while driving or in any situation where focusing on your phone is unsafe.",
    ],
  },
  {
    title: "5. Commitments & sessions",
    body: [
      "When you start a commitment, the Cx Coins are held from your balance for the duration of the session. Complete the session and they are returned in full, plus 25 Cx Coins for each completed study hour.",
      "If you end a session early, or fail the focus rules of Verified Mode, the committed amount is forfeited within the app. Session timing is based on real clock time and is settled on our servers.",
      "Verified Mode requires Do Not Disturb and fails if you intentionally leave the app, with a short grace window for emergency calls. Only one active session is allowed at a time.",
    ],
  },
  {
    title: "6. Group Study",
    body: [
      "Group Study lets up to twenty people share a synchronized session. Joining a group requires a commitment, which is held until the group session is settled.",
      "Leaving a group session before it ends forfeits your commitment. The organiser can start a session once at least one other member has joined. Group outcomes are decided by the server clock.",
    ],
  },
  {
    title: "7. Focus Shield (Android, optional)",
    body: [
      "Focus Shield is an optional helper in Standard Mode. When you turn it on and pick apps yourself, CommitX shows its own full-screen reminder over those apps for the length of your session, using Android's usage-access and display-over-other-apps permissions that you grant.",
      "Focus Shield never disables, hides, uninstalls, modifies or collects data from any other app, and it stops when your session ends. You can dismiss the reminder and leave at any time; if Android stops the shield, your session is unaffected and Verified Mode rules never apply to it.",
      "Focus Shield is not available on the website, where CommitX makes no claim to block anything.",
    ],
  },
  {
    title: "8. Using CommitX without an account",
    body: [
      "On our website you can run a Standard or Verified session as a guest. Guest sessions cost no Cx Coins, earn no Cx Coins, and are not saved anywhere. Create an account if you want your history, streaks and Cx Coins kept.",
    ],
  },
  {
    title: "9. Cx Coins & rewards",
    body: [
      "You earn 25 Cx Coins for each fully completed hour of focus. Partial hours earn nothing, and cancelled or failed sessions earn nothing.",
      "Cx Coins are not currency. They have no cash value, cannot be bought, withdrawn, transferred, sold or exchanged, and may be adjusted or reset while CommitX is in beta.",
      "Cx Coupons are not available yet. Any future rewards or partner benefits will be announced in the app and may come with their own conditions.",
    ],
  },
  {
    title: "10. Prohibited use",
    body: [
      "You may not reverse engineer, tamper with or automate the app, bypass session or focus checks, exploit bugs for balances or rewards, access other users' data, upload harmful or offensive content, or resell access to CommitX.",
    ],
  },
  {
    title: "11. Beta-phase limitations",
    body: [
      "CommitX is in open beta. Features, rules, balances and rewards may change, break or be reset without notice, and data loss is possible.",
      "Every balance inside the app is measured in Cx Coins. CommitX has no deposits, no top-ups and no cash-outs of any kind.",
    ],
  },
  {
    title: "12. Service availability",
    body: [
      "We aim to keep CommitX available and accurate, but we do not guarantee uninterrupted service. Maintenance, updates, device restrictions or connectivity issues may interrupt sessions.",
    ],
  },
  {
    title: "13. Suspension & termination",
    body: [
      "We may suspend or terminate accounts that abuse the app, exploit rewards, or breach these terms. You can delete your account at any time from Settings, which permanently removes your data, balances and Cx Coins.",
    ],
  },
  {
    title: "14. Intellectual property",
    body: [
      "CommitX, its name, logo, design, animations and software are owned by us and protected by applicable law. You may not copy, modify or distribute them without permission.",
      "The study content you create inside the app remains yours.",
    ],
  },
  {
    title: "15. Limitation of liability",
    body: [
      "CommitX is provided \u201cas is\u201d, without warranties of any kind. To the extent permitted by law, we are not liable for lost focus time, forfeited Cx Coins, lost coins or streaks, data loss, or any indirect or consequential damages arising from your use of the app.",
    ],
  },
  {
    title: "16. Changes to terms",
    body: [
      "We may update these terms as CommitX evolves. Material changes will be announced inside the app, and continuing to use CommitX after an update means you accept the revised terms.",
    ],
  },
  {
    title: "17. Contact",
    body: [
      "Questions about these terms? Email us at commitx07@gmail.com.",
    ],
  },
];

function TermsPage() {
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
            Terms of Service
          </h1>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ScrollText className="h-4 w-4 text-primary" />
          <span>Plain rules for commitments, groups and Cx Coins.</span>
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
