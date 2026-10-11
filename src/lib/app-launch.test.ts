import { describe, expect, test } from "bun:test";
import { isNativeLaunchReady, shouldShowNativeWelcome } from "./app-launch";

describe("native launch handoff", () => {
  test("waits for auth rather than revealing a loading screen", () => {
    expect(isNativeLaunchReady(true, false, "/")).toBe(false);
    expect(isNativeLaunchReady(true, true, "/")).toBe(false);
  });
  test("waits for sign-in redirects and accepts the destination", () => {
    expect(isNativeLaunchReady(false, false, "/")).toBe(false);
    expect(isNativeLaunchReady(false, false, "/auth")).toBe(true);
    expect(isNativeLaunchReady(false, true, "/auth")).toBe(false);
    expect(isNativeLaunchReady(false, true, "/")).toBe(true);
  });
  test("never interrupts a restored session with onboarding", () => {
    expect(shouldShowNativeWelcome("/", true)).toBe(false);
    expect(shouldShowNativeWelcome("/session", false)).toBe(false);
    expect(shouldShowNativeWelcome("/", false)).toBe(true);
  });
});