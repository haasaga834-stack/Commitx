import { test } from "node:test";
import assert from "node:assert/strict";
import { countdownPayload, type VerifiedCountdownPayload } from "./verified-countdown";

const session: VerifiedCountdownPayload = {
  id: "session-1", goal: "Study", theme: "tree", durationMs: 3600000,
  remainingMs: 3599000, running: true, phase: "focus", breakEndsAt: null, breakAt: null,
};
test("countdown is timestamp-driven, not a decrementing notification counter", () => {
  assert.equal(countdownPayload(session, 1000).endsAt, 3600000);
  assert.equal(countdownPayload({ ...session, remainingMs: 3598000 }, 2000).endsAt, 3600000);
});
test("break and paused focus do not advance the study countdown", () => {
  assert.equal(countdownPayload({ ...session, running: false }, 1000).endsAt, null);
  assert.equal(countdownPayload({ ...session, phase: "recovery_break" }, 1000).endsAt, null);
  assert.equal(countdownPayload({ ...session, phase: "awaiting_confirmation" }, 1000).endsAt, null);
});
test("timer end clamps at zero without creating a reward or session outcome", () => {
  const result = countdownPayload({ ...session, remainingMs: -1000 }, 2000);
  assert.equal(result.remainingMs, 0);
  assert.equal(result.endsAt, 2000);
  assert.equal("status" in result, false);
});