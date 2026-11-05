/** Referral links, Play Store attribution and the share message. Pure helpers. */
export const REFERRAL_BASE = "https://commitx.site/r/";
const PACKAGE = "app.commitx.mobile";

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 4 && code.length <= 32 ? code : null;
}

export function referralLink(code: string): string {
  return REFERRAL_BASE + encodeURIComponent(code);
}

/** Play listing carrying the code through installation (Play Install Referrer API). */
export function playStoreReferralUrl(code: string): string {
  return `https://play.google.com/store/apps/details?id=${PACKAGE}&referrer=${encodeURIComponent(`ref=${code}`)}`;
}

/** Chrome intent URL: opens the installed app, otherwise the attributed Play listing. */
export function androidIntentUrl(code: string): string {
  return (
    `intent://r/${encodeURIComponent(code)}#Intent;scheme=commitx;package=${PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(playStoreReferralUrl(code))};end`
  );
}

/** Extracts the code from an install-referrer string such as "ref=CX123ABC&utm_source=…". */
export function codeFromInstallReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return normalizeReferralCode(new URLSearchParams(referrer).get("ref"));
  } catch {
    return null;
  }
}

/** Share text points straight at the Play listing; the code rides along via Install Referrer. */
export function referralShareMessage(code: string): string {
  return (
    "Hey! I've been using CommitX to stay focused, study with friends and build better habits. " +
    `Download it from Google Play with my link and get 100 extra CX Coins: ${playStoreReferralUrl(code)}\n\n` +
    `My referral code: ${code}`
  );
}
