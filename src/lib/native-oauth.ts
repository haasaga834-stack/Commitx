import { supabase } from "@/integrations/supabase/client";

/**
 * Android browser-based Google sign-in.
 *
 * Google refuses embedded WebViews, so the consent screen is opened in the
 * device browser with redirectTo = commitx://login-callback/. The native shell
 * owns that scheme, hands the callback URL back here, and this module finishes
 * the Supabase session exchange inside the app (where the PKCE verifier lives).
 */

type Bridge = {
  oauthRedirectUri?: () => string;
  openExternalAuth?: (url: string) => boolean;
};

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { CommitXAndroid?: Bridge }).CommitXAndroid ?? null;
}

export const ANDROID_REDIRECT_URI = "commitx://login-callback/";

/** True when this build can complete the browser OAuth round-trip natively. */
export function canUseNativeOAuth(): boolean {
  const b = bridge();
  return typeof b?.openExternalAuth === "function";
}

function redirectUri(): string {
  try {
    const fromNative = bridge()?.oauthRedirectUri?.();
    if (fromNative && fromNative.startsWith("commitx://")) return fromNative;
  } catch {
    /* fall through */
  }
  return ANDROID_REDIRECT_URI;
}

async function completeFromCallbackUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const params = url.searchParams;

  const errorDescription =
    params.get("error_description") ?? hash.get("error_description") ?? params.get("error") ?? hash.get("error");
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get("code") ?? hash.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const access_token = hash.get("access_token") ?? params.get("access_token");
  const refresh_token = hash.get("refresh_token") ?? params.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return;
  }

  throw new Error("google_callback_incomplete");
}

/**
 * Starts Google sign-in in the device browser and resolves once the callback
 * has produced a Supabase session. Rejects on provider errors or timeout.
 */
export function nativeBrowserGoogleSignIn(): Promise<void> {
  const b = bridge();
  if (!b?.openExternalAuth) return Promise.reject(new Error("native_unavailable"));

  return new Promise<void>((resolve, reject) => {
    const w = window as unknown as {
      CommitXOAuth?: { onCallback: (url: string) => void };
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 300000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete w.CommitXOAuth;
    }

    // Single callback handler — replaces any previously registered one.
    w.CommitXOAuth = {
      onCallback: async (callbackUrl: string) => {
        try {
          await completeFromCallbackUrl(callbackUrl);
          cleanup();
          resolve();
        } catch (e) {
          cleanup();
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
    };

    void (async () => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUri(),
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("google_url_missing");
        if (!b.openExternalAuth!(data.url)) throw new Error("browser_unavailable");
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  });
}
