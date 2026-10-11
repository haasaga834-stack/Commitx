/** Fallback for older bridges and apps without Android category metadata. */
const SOCIAL_PACKAGES = new Set([
  "com.instagram.android", "com.instagram.lite", "com.google.android.youtube",
  "com.facebook.katana", "com.facebook.lite", "com.whatsapp", "com.whatsapp.w4b",
  "com.facebook.orca", "com.reddit.frontpage", "com.twitter.android",
  "com.snapchat.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
  "org.telegram.messenger", "org.thunderdog.challegram", "com.discord",
  "com.pinterest", "com.linkedin.android", "com.bsky.app", "com.instagram.barcelona",
]);
const GAME_PACKAGES = new Set([
  "com.dts.freefireth", "com.dts.freefiremax", "com.pubg.imobile", "com.tencent.ig",
  "com.activision.callofduty.shooter", "com.supercell.clashofclans",
  "com.supercell.clashroyale", "com.supercell.brawlstars", "com.mojang.minecraftpe",
  "com.roblox.client", "com.king.candycrushsaga", "com.ea.gp.fifamobile",
]);

export function defaultShieldPackages(apps: { pkg: string; defaultBlocked?: boolean }[]): string[] {
  return apps.filter((app) => app.defaultBlocked || SOCIAL_PACKAGES.has(app.pkg) || GAME_PACKAGES.has(app.pkg))
    .map((app) => app.pkg);
}

export function canConfirmShield(supported: boolean, usage: boolean, overlay: boolean, packages: string[]): boolean {
  return supported && usage && overlay && packages.length > 0;
}