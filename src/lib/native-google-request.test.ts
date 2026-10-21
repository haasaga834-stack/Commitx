import { describe, expect, test } from "bun:test";
import { requestNativeGoogleSignIn } from "./native-google-request";

function harness(timeoutMs = 1000) {
  let callbacks: Parameters<Parameters<typeof requestNativeGoogleSignIn>[0]["install"]>[0] | undefined;
  let clears = 0;
  let exchanges = 0;
  const promise = requestNativeGoogleSignIn({
    start: () => {}, install: value => { callbacks = value; },
    clear: () => { clears++; }, timeoutMs,
    exchange: async () => { exchanges++; },
  });
  return { promise, callbacks: () => callbacks, clears: () => clears, exchanges: () => exchanges };
}

describe("in-app Google sign-in lifecycle", () => {
  test("native token exchanges once, including duplicate callbacks", async () => {
    const h = harness();
    h.callbacks()?.onGoogleIdToken("test-only-token");
    h.callbacks()?.onGoogleIdToken("test-only-token");
    await h.promise;
    expect(h.exchanges()).toBe(1);
    expect(h.clears()).toBe(1);
  });
  test("cancellation cleans up and the next attempt stays native", async () => {
    const h = harness();
    const rejected = h.promise.catch(error => error);
    h.callbacks()?.onGoogleSignInError("GetCredentialCancellationException");
    expect((await rejected).message).toBe("GetCredentialCancellationException");
    const retry = harness();
    retry.callbacks()?.onGoogleIdToken("test-only-token");
    await retry.promise;
    expect(retry.exchanges()).toBe(1);
  });
  test("timeout removes callbacks and ignores late token without exchange", async () => {
    const h = harness(5);
    await expect(h.promise).rejects.toThrow("native_timeout");
    h.callbacks()?.onGoogleIdToken("late-test-token");
    expect(h.exchanges()).toBe(0);
    expect(h.clears()).toBe(1);
  });
  test("synchronous bridge failure cleans up", async () => {
    let cleared = false;
    await expect(requestNativeGoogleSignIn({
      start: () => { throw new Error("bridge_failed"); }, install: () => {},
      clear: () => { cleared = true; }, exchange: async () => {}, timeoutMs: 1000,
    })).rejects.toThrow("bridge_failed");
    expect(cleared).toBe(true);
  });
});