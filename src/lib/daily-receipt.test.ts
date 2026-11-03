import { describe, it, expect } from "vitest";
import { buildDailyReceipt } from "./daily-receipt";
import type { Session } from "./commitx-store";

const day = new Date(2026, 10, 3, 20, 0);
const at = (h: number) => new Date(2026, 10, 3, h, 0).getTime();
const s = (p: Partial<Session>): Session => ({ id: Math.random().toString(), goal: "", durationMinutes: 60, value: 50, mode: "standard", status: "completed", date: at(9), ...p });

describe("daily receipt", () => {
  it("counts only today's completed minutes and discipline", () => {
    const r = buildDailyReceipt([
      s({ durationMinutes: 120 }),
      s({ durationMinutes: 90, mode: "verified", date: at(14) }),
      s({ status: "failed", durationMinutes: 60 }),
      s({ date: new Date(2026, 10, 2, 9).getTime(), durationMinutes: 300 }),
    ], day);
    expect(r.lockedMinutes).toBe(210);
    expect(r.completed).toBe(2);
    expect(r.forfeited).toBe(1);
    expect(r.verified).toBe(1);
    expect(r.discipline).toBe(67);
    expect(r.hours[14]).toBe(90);
  });
  it("6h flawless is UNTOUCHABLE; empty day has no discipline", () => {
    expect(buildDailyReceipt([s({ durationMinutes: 360 })], day).verdict).toBe("UNTOUCHABLE");
    expect(buildDailyReceipt([], day).discipline).toBeNull();
  });
});
