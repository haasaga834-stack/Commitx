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
  it("any missed day fails the challenge", () => {
    const missedDay1 = challengeProgress({ startDay: "2026-11-01" }, [], "2026-11-02");
    expect(missedDay1.status).toBe("failed");
    const short = challengeProgress({ startDay: "2026-11-01" }, [s("2026-11-01", 179)], "2026-11-02");
    expect(short.status).toBe("failed");
  });
  it("meeting 3 Verified hours keeps it active", () => {
    const ok = challengeProgress({ startDay: "2026-11-01" }, [s("2026-11-01", 180)], "2026-11-02");
    expect(ok.status).toBe("active");
    expect(ok.day).toBe(2);
  });
  it("is day 3 on the third day", () => {
    expect(challengeProgress({ startDay: "2026-11-01" }, [], "2026-11-03").day).toBe(3);
  });
});
