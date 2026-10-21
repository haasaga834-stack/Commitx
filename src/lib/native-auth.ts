import { supabase } from "@/integrations/supabase/client";
import { requestNativeGoogleSignIn } from "./native-google-request";

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
export function isAndroidSignIn(): boolean {
  return bridge() !== null;
}

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
  const start = b?.googleSignIn;
  if (!start) return Promise.reject(new Error("native_unavailable"));
  if (pendingSignIn) return pendingSignIn;
  const w = window as unknown as {
    CommitXNativeAuth?: {
      onGoogleIdToken: (token: string) => void;
      onGoogleSignInError: (reason: string) => void;
    };
  };
  pendingSignIn = requestNativeGoogleSignIn({
    start: () => start.call(b),
    install: callbacks => { w.CommitXNativeAuth = callbacks; },
    clear: () => { delete w.CommitXNativeAuth; },
    exchange: async token => {
      const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
      if (error) throw error;
    },
    timeoutMs: 120000,
  }).finally(() => {
    pendingSignIn = null;
  });
  return pendingSignIn;
}

let pendingSignIn: Promise<void> | null = null;

export function nativeGoogleSignOut() {
  try {
    bridge()?.googleSignOut?.();
  } catch {
    /* no-op */
  }
}
