import type { Session } from "./commitx-store";

export interface DailyReceipt {
  dateKey: string;
  lockedMinutes: number;
  completed: number;
  forfeited: number;
  verified: number;
  longestMinutes: number;
  /** 0–100, completed / attempted. null when nothing attempted. */
  discipline: number | null;
  coinsEarned: number;
  verdict: string;
  receiptId: string;
  /** 24 hourly slots (local time) with completed minutes ending in each hour. */
  hours: number[];
}

export function receiptVerdict(minutes: number, forfeited: number, attempted: number): string {
  if (attempted === 0) return "NO RECEIPT. NO EXCUSES EITHER.";
  if (forfeited > 0 && minutes === 0) return "COMMITTED. THEN QUIT.";
  if (minutes >= 360 && forfeited === 0) return "UNTOUCHABLE";
  if (minutes >= 180 && forfeited === 0) return "LOCKED IN";
  if (minutes >= 180) return "STRONG, NOT FLAWLESS";
  if (minutes >= 60) return forfeited ? "SHOWED UP, SLIPPED ONCE" : "SOLID WORK";
  return "BARE MINIMUM";
}

export function buildDailyReceipt(sessions: Session[], day: Date = new Date()): DailyReceipt {
  const key = day.toDateString();
  const todays = sessions.filter((s) => new Date(s.date).toDateString() === key);
  const done = todays.filter((s) => s.status === "completed");
  const failed = todays.filter((s) => s.status === "failed");
  const lockedMinutes = done.reduce((n, s) => n + s.durationMinutes, 0);
  const hours = Array.from({ length: 24 }, () => 0);
  for (const s of done) hours[new Date(s.date).getHours()] += s.durationMinutes;
  const attempted = todays.length;
  const y = day.getFullYear(), m = day.getMonth() + 1, d = day.getDate();
  const seed = (y * 372 + m * 31 + d + lockedMinutes * 7 + attempted * 13) % 1679616;
  return {
    dateKey: key,
    lockedMinutes,
    completed: done.length,
    forfeited: failed.length,
    verified: done.filter((s) => s.mode === "verified").length,
    longestMinutes: done.reduce((n, s) => Math.max(n, s.durationMinutes), 0),
    discipline: attempted ? Math.round((done.length / attempted) * 100) : null,
    coinsEarned: done.reduce((n, s) => n + (s.coinsEarned ?? 0), 0),
    verdict: receiptVerdict(lockedMinutes, failed.length, attempted),
    receiptId: `CX-${String(y).slice(2)}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}-${seed.toString(36).toUpperCase().padStart(4, "0")}`,
    hours,
  };
}
