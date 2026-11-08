import type { Session } from "./commitx-store";
import { todayKey } from "./planner";

/** 21-Day Challenge rules: only completed Verified sessions count. */
export const CHALLENGE_DAYS = 21;
export const CHALLENGE_DAILY_MINUTES = 180;
/** No Freeze Shield: any day below the target ends the challenge. */
export const CHALLENGE_FREEZES = 0;

export interface ChallengeRecord {
  /** Local YYYY-MM-DD the challenge started (Day 1). */
  startDay: string;
}

export type ChallengeStatus = "active" | "failed" | "completed";

export interface ChallengeProgress {
  status: ChallengeStatus;
  /** 1-based current day (capped at 21). */
  day: number;
  todayMinutes: number;
  /** Per-day verified minutes for days 1..day. */
  days: { key: string; minutes: number; met: boolean; frozen: boolean }[];
  freezesUsed: number;
}

function dayFromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key: string, n: number) {
  const d = dayFromKey(key);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

/** Verified completed minutes per local day. */
export function verifiedMinutesByDay(sessions: Session[]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.mode !== "verified" || s.status !== "completed") continue;
    const k = todayKey(new Date(s.date));
    map.set(k, (map.get(k) ?? 0) + s.durationMinutes);
  }
  return map;
}

export function challengeProgress(
  record: ChallengeRecord,
  sessions: Session[],
  today = todayKey(),
): ChallengeProgress {
  const byDay = verifiedMinutesByDay(sessions);
  const elapsed = Math.round((dayFromKey(today).getTime() - dayFromKey(record.startDay).getTime()) / 86_400_000);
  const day = Math.min(CHALLENGE_DAYS, Math.max(1, elapsed + 1));
  const days: ChallengeProgress["days"] = [];
  let freezesUsed = 0;
  let failed = false;
  const lastIndex = Math.min(elapsed, CHALLENGE_DAYS - 1);
  for (let i = 0; i <= lastIndex; i++) {
    const key = addDays(record.startDay, i);
    const minutes = byDay.get(key) ?? 0;
    const met = minutes >= CHALLENGE_DAILY_MINUTES;
    const past = key < today;
    let frozen = false;
    if (past && !met) {
      if (freezesUsed < CHALLENGE_FREEZES) { freezesUsed++; frozen = true; }
      else failed = true;
    }
    days.push({ key, minutes, met, frozen });
  }
  const allDone = days.length === CHALLENGE_DAYS && days.every((d) => d.met || d.frozen);
  return {
    status: failed ? "failed" : allDone ? "completed" : "active",
    day,
    todayMinutes: byDay.get(today) ?? 0,
    days,
    freezesUsed,
  };
}

/** Roast shown the moment a missed day ends the challenge. */
export function challengeFailRoast(p: ChallengeProgress) {
  const missed = p.days.find((d) => !d.met && !d.frozen && d.key < todayKey());
  const dayNo = missed ? p.days.indexOf(missed) + 1 : p.day;
  const m = missed?.minutes ?? 0;
  const done = m <= 0 ? "0 minutes" : `${Math.floor(m / 60)}h ${m % 60}m`;
  return `Day ${dayNo}/21: ${done} of 3h. Challenge over. Your phone won.`;
}

/** Short roast for the current state of today's quota. */
export function challengeRoast(p: ChallengeProgress, hour = new Date().getHours()) {
  const left = CHALLENGE_DAILY_MINUTES - p.todayMinutes;
  if (left <= 0) return `Day ${p.day}/21 conquered. Rest up, tomorrow we go again.`;
  if (p.todayMinutes === 0 && hour >= 14) return `Day ${p.day} of 21 and 0 minutes. Reels won't clear your exam.`;
  if (hour >= 21) return `Only a few hours left to save your streak. Start a Verified session now.`;
  if (hour >= 18 && p.todayMinutes < 90) return `Half the day gone, not even halfway to 3 hours. Lock in.`;
  return `${Math.floor(left / 60)}h ${left % 60}m of Verified study left today.`;
}

const recordKey = (uid: string) => `commitx-challenge:${uid}`;
const morningKey = (uid: string) => `commitx-challenge-morning:${uid}`;
const inviteKey = (uid: string) => `commitx-challenge-invite:${uid}`;

function read<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(k: string, v: unknown) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export const getChallenge = (uid: string) => read<ChallengeRecord>(recordKey(uid));
export const startChallenge = (uid: string) => write(recordKey(uid), { startDay: todayKey() } satisfies ChallengeRecord);
export const endChallenge = (uid: string) => write(recordKey(uid), null);
export const morningDone = (uid: string) => read<string>(morningKey(uid)) === todayKey();
export const markMorningDone = (uid: string) => write(morningKey(uid), todayKey());
/** Invitation is offered at most once per day until accepted. */
export const inviteSeenToday = (uid: string) => read<string>(inviteKey(uid)) === todayKey();
export const markInviteSeen = (uid: string) => write(inviteKey(uid), todayKey());
