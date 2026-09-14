// Offline support registration.
//
// The service worker is generated at build time by vite-plugin-pwa (generateSW)
// and served from /commitx-sw.js. Registration happens ONLY here, and only in a
// real published production page — never in dev, never inside the Lovable
// preview iframe, never when ?sw=off is used as a kill switch, and never inside
// the native Android app (which must not register the website's service worker).
//
// /sw.js is reserved for Monetag verification and must not be touched by this
// registration logic.

import { hasNativeBridge } from "./native-session";

const SW_URL = "/commitx-sw.js";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => {
          const url =
            registration.active?.scriptURL ??
            registration.waiting?.scriptURL ??
            registration.installing?.scriptURL ??
            "";
          // Only our app shell worker — leave any messaging worker alone.
          return url.endsWith(SW_URL);
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    /* nothing we can do */
  }
}

export function registerAppServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    hasNativeBridge() ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (refused) {
    void unregisterAppWorkers();
    return;
  }

  const register = () => {
    navigator.serviceWorker.register(SW_URL).catch(() => {
      /* offline support is best-effort */
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
