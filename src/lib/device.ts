/** Stable-ish per-device fingerprint used to block duplicate referral claims. */
const KEY = "commitx-device-id-v1";

export function getDeviceHash(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    const fingerprint = [
      id,
      navigator.userAgent,
      String(screen.width),
      String(screen.height),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");
    // Simple deterministic hash — the value only needs to be stable and opaque.
    let h = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      h = (h * 31 + fingerprint.charCodeAt(i)) | 0;
    }
    return `${id}:${(h >>> 0).toString(36)}`;
  } catch {
    return "";
  }
}
