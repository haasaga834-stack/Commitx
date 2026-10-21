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
      "CommitX is a focus and accountability app that helps you commit to study sessions and follow through on them. This Privacy Policy explains what information we collect, why we collect it, how long we keep it, and the choices you have.",
      "It applies to the CommitX Android app and the CommitX website. By creating an account and using CommitX, you agree to the practices described here.",
      "CommitX is developed and operated by Aniket Kumar, an independent individual developer based in India (not a company or organisation). Data controller and contact: Aniket Kumar, commitx07@gmail.com.",
      "Last updated: 14 September 2026.",
    ],
  },
  {
    title: "2. Using CommitX without an account",
    body: [
      "You can start a Standard or Verified session on our website as a guest, without signing in. Guest sessions are not saved: no account is created, no history, streaks or Cx Coins are stored, and nothing about that session is written to our servers.",
      "An account is only needed if you want your sessions, plans and Cx Coins to be saved.",
    ],
  },
  {
    title: "3. Account information you provide",
    body: [
      "When you create an account we store your email address and a display name. If you sign in with Google, Google returns your basic profile details (name, email address and profile picture) and we use them to create your account.",
      "Optional profile details you can add or leave blank: profile photo, age, sex and education level. These are shown only to you inside the app and are never used for advertising.",
      "If you use a referral code, we store your own referral code, the account that referred you, and a device fingerprint (a short non-reversible value derived from your browser/device) used solely to stop the same device claiming referral rewards more than once.",
    ],
  },
  {
    title: "4. Information created by using the app",
    body: [
      "Commitments and focus sessions: goal text, duration, mode (Standard, Verified or Group), the Cx Coins committed, the outcome and, for a failed session, the technical reason it ended (for example that the page was reloaded or closed).",
      "Study data: study plans, to-dos, subjects, exam dates and revision progress, plus your daily and weekly goal settings, theme, reminder preferences and streak/stat totals.",
      "Cx Coins: your balance and the amount currently held behind an active commitment.",
      "Live session state: while a session runs we store one row with its start time, duration, mode and periodic check-in times, so a session can be recovered and only one session runs per account.",
      "Focus Shield (Android): if you turn it on, the list of app package names you chose to be reminded about is saved with your live session, together with whether the shield is on and its start/end time.",
    ],
  },
  {
    title: "5. Group Study and leaderboard visibility",
    body: [
      "If you join a Group Study, the other members of that group can see your display name and your status in that session (committed, focusing, finished or left). They cannot see your other sessions, plans, subjects or balance.",
      "The community leaderboard shows a public top ten: display name and total completed focus minutes. If you do not want your display name to appear there, change it in your profile or do not complete sessions while signed in. Everyone's own totals are visible only to themselves.",
    ],
  },
  {
    title: "6. Device permissions we ask for (Android)",
    body: [
      "Notifications: to send the session, plan and break reminders you enable. You can deny or revoke this at any time in Android settings.",
      "Alarms and reminders (exact alarms, restart after reboot): so scheduled study reminders and break sounds fire at the right time and survive a restart.",
      "Usage access (app usage statistics): optional. Used by the screen-time feature and by Focus Shield to detect which app is in the foreground. This information is processed on your device only — CommitX does not upload your app usage or screen-time history.",
      "Display over other apps: optional, used only so Focus Shield can show a CommitX reminder screen over an app you selected. Focus Shield never disables, hides, uninstalls or changes any other app.",
      "Installed-app check: the app checks whether a small fixed list of well-known apps is installed, so the Focus Shield picker can show their names and icons. That list is not sent to our servers; only the packages you actively choose are saved with your session.",
      "Do Not Disturb status: Verified Mode reads whether Do Not Disturb is on. Only the on/off state is read, never your notifications.",
      "Camera and microphone are used only when you choose to start the optional Study Buddy cam with your paired buddy. Video and audio travel directly between the two devices, the microphone starts muted, and nothing is recorded or stored on our servers. CommitX does not request access to your location, contacts, call logs, SMS, files or health data.",
    ],
  },
  {
    title: "7. How we use your information",
    body: [
      "To create and secure your account; to run, verify and settle focus sessions; to keep streaks, stats and Cx Coin balances correct; to run Group Study with people you invite; to send the reminders you enable; to prevent referral and reward abuse; and to fix errors and keep the service reliable.",
      "We do not use your study data for advertising, profiling or automated decisions, and we do not sell personal information.",
      "Product analytics and crash reports: we use PostHog to count anonymous usage events (for example: a session started, completed or abandoned, its mode and a rough duration range, sign-up steps, joining a group) and to receive error reports when the app crashes. These events never include your goals, notes, email or name; they are linked to an internal account ID only so we can fix reliability problems. Session recordings are turned off.",
    ],
  },
  {
    title: "8. Where your data is stored",
    body: [
      "Account and app data is stored in our managed cloud database (hosted infrastructure operated on our behalf), protected by row-level security so records are readable only by your own authenticated account. Data is transmitted over encrypted connections.",
      "Some preferences and session state are also cached on your device so the app works offline and your timer stays accurate if the app restarts. Clearing app data removes that local copy.",
    ],
  },
  {
    title: "9. Third-party services",
    body: [
      "Cloud database, authentication and email delivery: our managed backend provider, which processes your data only to provide the service to us.",
      "Google Sign-In (optional) and Google Play services used for in-app sign-in and the in-app review prompt.",
      "Google Fonts, used to load typography on our web pages.",
      "Advertising: our public website pages may show Google AdSense ads, which can set cookies or use identifiers to show and measure ads. This is on the website only — the CommitX Android app does not show ads and does not load ad code. You can manage ad settings at https://myadcenter.google.com. We never send advertising partners your study data, sessions, plans or Cx Coin balance.",
    ],
  },
  {
    title: "10. Authentication and email",
    body: [
      "Sign-in is handled by our authentication provider. Passwords are stored only as salted hashes and are never visible to us. With Google Sign-In, Google verifies your identity and we receive only basic profile information.",
      "We send transactional emails (sign-up confirmation, password reset, email change, magic links) to your registered address. Reset and magic links expire after a short period. We do not send marketing emails.",
    ],
  },
  {
    title: "11. How long we keep data",
    body: [
      "Account, session, plan and Cx Coin records are kept while your account exists, so your history and streaks stay accurate.",
      "Live session rows are removed when the session ends, and abandoned ones are cleared automatically. Guest sessions are never stored.",
      "When you delete your account, your records are deleted immediately as described below. Backups of our hosting provider may retain copies for a short rolling period before they expire.",
    ],
  },
  {
    title: "12. Your rights and account deletion",
    body: [
      "You can view and edit your profile, plans, subjects and preferences at any time in the app. You can request a copy of your data, or ask us to correct it, by emailing commitx07@gmail.com.",
      "You can delete your account yourself: Settings → Delete account. This permanently removes your profile and profile photo, focus session history, live session, study plans, to-dos, subjects, settings, referrals, group memberships and groups you created, student reviews you submitted, your leaderboard entry, your Cx Coin balance and your login credentials. It cannot be undone and Cx Coins are not recoverable.",
      "Delete your account without the app: email commitx07@gmail.com from your registered address with the subject \"Delete my CommitX account\". We verify the request and delete the account and all the data listed above within 30 days, then confirm by email.",
      "Exact-time reminders: if you schedule study plan reminders, CommitX may ask Android for permission to deliver them at the exact time you chose. If you decline, reminders still arrive, possibly a few minutes late.",
      "Depending on where you live, you may also have the right to object to or restrict certain processing, or to complain to your local data protection authority.",
    ],
  },
  {
    title: "13. Children's privacy",
    body: [
      "CommitX is intended for users aged 13 and above and is not directed at children. We do not knowingly collect information from children under 13. If you believe a child has created an account, email us and we will delete it.",
      "Younger users should use CommitX with the involvement of a parent or guardian.",
    ],
  },
  {
    title: "14. Changes to this policy",
    body: [
      "CommitX is in active beta, so this policy may be updated as features change. Material changes will be announced inside the app, and the current version is always on this page with its last-updated date.",
    ],
  },
  {
    title: "15. Contact",
    body: [
      "Questions about this policy, your data, or a deletion request? Email commitx07@gmail.com and we will get back to you.",
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
              id={s.title.startsWith("12.") ? "delete-account" : undefined}
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
