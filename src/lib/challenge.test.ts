import { describe, expect, it } from "bun:test";
import { challengeProgress } from "./challenge";
import type { Session } from "./commitx-store";

const s = (day: string, min: number, mode: "verified" | "standard" = "verified"): Session => ({
  id: day + min + mode, goal: "", durationMinutes: min, value: 0, mode, status: "completed",
  date: new Date(`${day}T10:00:00`).getTime(),
});

describe("21-day challenge", () => {
  it("counts only verified sessions toward 3 hours", () => {
    const p = challengeProgress({ startDay: "2026-11-01" }, [s("2026-11-01", 120), s("2026-11-01", 120, "standard")], "2026-11-01");
    expect(p.todayMinutes).toBe(120);
    expect(p.days[0].met).toBe(false);
  });
  it("one missed day uses the freeze, a second fails", () => {
    const ok = challengeProgress({ startDay: "2026-11-01" }, [s("2026-11-02", 180)], "2026-11-03");
    expect(ok.status).toBe("active");
    expect(ok.freezesUsed).toBe(1);
    const bad = challengeProgress({ startDay: "2026-11-01" }, [], "2026-11-03");
    expect(bad.status).toBe("failed");
  });
  it("is day 3 on the third day", () => {
    expect(challengeProgress({ startDay: "2026-11-01" }, [], "2026-11-03").day).toBe(3);
  });
});
