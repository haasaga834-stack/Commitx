type Callbacks = {
  onGoogleIdToken: (token: string) => void;
  onGoogleSignInError: (reason: string) => void;
};

/** One owner for the chooser and token exchange; late callbacks cannot restart it. */
export function requestNativeGoogleSignIn(tools: {
  start: () => void;
  install: (callbacks: Callbacks) => void;
  clear: () => void;
  exchange: (token: string) => Promise<void>;
  timeoutMs: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let exchanging = false;
    const timeout = setTimeout(() => finish(new Error("native_timeout")), tools.timeoutMs);
    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      tools.clear();
      if (error) reject(error);
      else resolve();
    }
    tools.install({
      onGoogleIdToken: async token => {
        if (settled || exchanging) return;
        exchanging = true;
        try {
          await tools.exchange(token);
          finish();
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      },
      onGoogleSignInError: reason => {
        if (!exchanging) finish(new Error(reason || "google_sign_in_failed"));
      },
    });
    try { tools.start(); }
    catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}