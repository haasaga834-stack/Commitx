import { supabase } from "@/integrations/supabase/client";

type Bridge = {
  hasNativeGoogleSignIn?: () => boolean;
  configureGoogleSignIn?: (clientId: string) => void;
  googleSignIn?: () => void;
  googleSignOut?: () => void;
};

/**
 * Public Web (server) OAuth client ID. Not a secret — it is visible in every
 * Google consent URL. Handed to older Android builds at runtime so the in-app
 * account chooser works without reinstalling.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "1071070006682-q095d7588gsb7ap7joh8t1p5ls3epvtj.apps.googleusercontent.com";

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { CommitXAndroid?: Bridge }).CommitXAndroid;
  return b ?? null;
}

/** True when the Android shell can run Google Sign-In natively (no browser). */
export function hasNativeGoogleSignIn(): boolean {
  const b = bridge();
  try {
    b?.configureGoogleSignIn?.(GOOGLE_WEB_CLIENT_ID);
  } catch {
    /* older shells without the setter still fall back below */
  }
  try {
    return !!b?.googleSignIn && b.hasNativeGoogleSignIn?.() === true;
  } catch {
    return false;
  }
}

/**
 * Runs the native Android Credential Manager Google flow and exchanges the
 * returned Google ID token for a Supabase session — entirely in-app.
 */
export function nativeGoogleSignIn(): Promise<void> {
  const b = bridge();
  if (!b?.googleSignIn) return Promise.reject(new Error("native_unavailable"));

  return new Promise<void>((resolve, reject) => {
    const w = window as unknown as {
      CommitXNativeAuth?: {
        onGoogleIdToken: (t: string) => void;
        onGoogleSignInError: (r: string) => void;
      };
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 120000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete w.CommitXNativeAuth;
    }

    w.CommitXNativeAuth = {
      onGoogleIdToken: async (token: string) => {
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token,
          });
          cleanup();
          if (error) reject(error);
          else resolve();
        } catch (e) {
          cleanup();
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      onGoogleSignInError: (reason: string) => {
        cleanup();
        reject(new Error(reason || "google_sign_in_failed"));
      },
    };

    b.googleSignIn!();
  });
}

export function nativeGoogleSignOut() {
  try {
    bridge()?.googleSignOut?.();
  } catch {
    /* no-op */
  }
}
