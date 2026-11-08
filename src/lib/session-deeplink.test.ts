import { describe, expect, it } from "bun:test";
import { isAllowedDuringSession } from "./session-deeplink";

describe("notification taps during a running session", () => {
  it("blocks the Screen Time notification from leaving the timer", () => {
    expect(isAllowedDuringSession("/screen-time")).toBe(false);
    expect(isAllowedDuringSession("screen-time")).toBe(false);
  });

  it("blocks Planner, Home and widget quick start", () => {
    expect(isAllowedDuringSession("/planner")).toBe(false);
    expect(isAllowedDuringSession("/")).toBe(false);
    expect(isAllowedDuringSession("/commit?mode=verified&duration=30&quick=1")).toBe(false);
  });

  it("still allows the timer and its result screens", () => {
    expect(isAllowedDuringSession("/session?goal=Study")).toBe(true);
    expect(isAllowedDuringSession("session")).toBe(true);
    expect(isAllowedDuringSession("/success")).toBe(true);
    expect(isAllowedDuringSession("/failed")).toBe(true);
  });
});
