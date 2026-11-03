import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setPendingReferral } from "@/lib/pending-referral";
import { androidIntentUrl, normalizeReferralCode, playStoreReferralUrl } from "@/lib/referral-link";
import { hasNativeBridge } from "@/lib/native-notifications";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "Join CommitX — 100 bonus CX Coins" },
      { name: "description", content: "Your friend invited you to CommitX. Join with their link and get 100 extra CX Coins." },
      { property: "og:title", content: "Join CommitX — 100 bonus CX Coins" },
      { property: "og:description", content: "Stay focused, study with friends and build better habits. Join with this invite for 100 extra CX Coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralLanding,
});

function ReferralLanding() {
  const { code: raw } = Route.useParams();
  const code = normalizeReferralCode(raw);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    if (!code) return;
    setPendingReferral(code);
    if (hasNativeBridge()) {
      window.location.replace(`/auth?ref=${code}`);
      return;
    }
    const isAndroid = /android/i.test(navigator.userAgent);
    setAndroid(isAndroid);
    // Installed app opens directly; otherwise Play Store keeps the code for first launch.
    if (isAndroid) window.location.href = androidIntentUrl(code);
  }, [code]);

  return (
    <main className="auth-forest flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">You're invited</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Join CommitX</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Sign up with this invite and get 100 extra CX Coins on top of your 300 welcome coins.
      </p>
      {code && (
        <p className="mt-6 rounded-2xl border border-dashed border-hairline px-5 py-3 font-mono text-lg tracking-widest text-foreground">
          {code}
        </p>
      )}
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        {code && (
          <a
            href={android ? androidIntentUrl(code) : playStoreReferralUrl(code)}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Get CommitX on Google Play
          </a>
        )}
        <Link to="/auth" className="rounded-2xl border border-hairline px-5 py-3 text-sm text-foreground">
          Sign up on the website
        </Link>
      </div>
      <p className="mt-6 max-w-xs text-[11px] text-muted-foreground">
        If the code isn't filled in automatically, paste it in the referral code box when you sign up.
      </p>
    </main>
  );
}
