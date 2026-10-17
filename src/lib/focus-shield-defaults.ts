/** Fallback for older bridges and apps without Android category metadata. */
const SOCIAL_PACKAGES = new Set([
  "com.instagram.android", "com.instagram.lite", "com.google.android.youtube",
  "com.facebook.katana", "com.facebook.lite", "com.whatsapp", "com.whatsapp.w4b",
  "com.facebook.orca", "com.reddit.frontpage", "com.twitter.android",
  "com.snapchat.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
  "com.discord",
  "com.pinterest", "com.linkedin.android", "com.bsky.app", "com.instagram.barcelona",
]);
const GAME_PACKAGES = new Set([
  "com.dts.freefireth", "com.dts.freefiremax", "com.pubg.imobile", "com.tencent.ig",
  "com.activision.callofduty.shooter", "com.supercell.clashofclans",
  "com.supercell.clashroyale", "com.supercell.brawlstars", "com.mojang.minecraftpe",
  "com.roblox.client", "com.king.candycrushsaga", "com.ea.gp.fifamobile",
]);

const OPTIONAL_TELEGRAM_PACKAGES = new Set(["org.telegram.messenger", "org.telegram.messenger.web", "org.thunderdog.challegram"]);
/** Older bridges fall back to known browsers; current Android bridges detect URL handlers. */
const BROWSER_PACKAGES = new Set([
  "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
  "com.microsoft.emmx", "com.microsoft.emmx.beta", "com.microsoft.emmx.dev", "com.microsoft.emmx.canary",
  "org.mozilla.firefox", "org.mozilla.firefox_beta", "org.mozilla.fenix", "org.mozilla.focus",
  "com.brave.browser", "com.brave.browser_beta", "com.brave.browser_nightly",
  "com.opera.browser", "com.opera.browser.beta", "com.opera.mini.native", "com.opera.touch",
  "com.sec.android.app.sbrowser", "com.sec.android.app.sbrowser.beta",
  "com.duckduckgo.mobile.android", "com.vivaldi.browser", "com.vivaldi.browser.snapshot",
  "com.UCMobile.intl", "com.uc.browser.en", "com.mi.globalbrowser", "com.android.browser",
  "com.heytap.browser", "com.vivo.browser", "com.huawei.browser", "com.yandex.browser",
  "org.torproject.torbrowser", "org.torproject.torbrowser_alpha",
]);

export function defaultShieldPackages(apps: { pkg: string; defaultBlocked?: boolean }[]): string[] {
  return apps.filter((app) => !OPTIONAL_TELEGRAM_PACKAGES.has(app.pkg)
    && (app.defaultBlocked || SOCIAL_PACKAGES.has(app.pkg) || GAME_PACKAGES.has(app.pkg) || BROWSER_PACKAGES.has(app.pkg)))
    .map((app) => app.pkg);
}

export function canConfirmShield(supported: boolean, usage: boolean, overlay: boolean, packages: string[]): boolean {
  return supported && usage && overlay && packages.length > 0;
}