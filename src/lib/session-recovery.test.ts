import { test } from "node:test";
import assert from "node:assert/strict";
import { recoverSessionProgress } from "./session-recovery";
import type { ActiveVerifiedSession } from "./verified-mode";
const start = 1_000_000;
const ticket: ActiveVerifiedSession = { id: "stable", goal: "Study", duration: 60, value: 50,
  mode: "standard", startedAt: start, runningSince: start, accumulatedMs: 0, phase: "focus" };
test("reopening at or beyond completion preserves the original timer identity and timestamps", () => {
  for (const delta of [-1, 0, 1, 8 * 3600_000]) {
    const restored = recoverSessionProgress(ticket, start + 3600_000 + delta);
    assert.equal(restored.startedAt, start);
    assert.equal(restored.id, "stable");
    assert.equal(restored.runningSince, start);
  }
});
test("suspension beyond a long session's end cannot skip its halfway break or YES gate", () => {
  const restored = recoverSessionProgress({ ...ticket, duration: 180 }, start + 180 * 60_000);
  assert.equal(restored.accumulatedMs, 90 * 60_000);
  assert.equal(restored.phase, "awaiting_confirmation");
  assert.equal(restored.runningSince, null);
  assert.equal(restored.breakStartedAt, start + 90 * 60_000);
});
test("a two-hour session has no break and confirmed breaks do not repeat", () => {
  assert.equal(recoverSessionProgress({ ...ticket, duration: 120 }, start + 121 * 60_000).phase, "focus");
  assert.equal(recoverSessionProgress({ ...ticket, duration: 180, breaksTaken: 1 }, start + 181 * 60_000).phase, "focus");
});