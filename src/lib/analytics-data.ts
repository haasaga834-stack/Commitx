import type { Session } from "./commitx-store";

export interface StudyAnalytics {
  /** Mon..Sun minutes for the current week */
  week: { label: string; minutes: number; isToday: boolean }[];
  weeklyMinutes: number;
  monthlyMinutes: number;
  averageDailyMinutes: number;
  streak: number;
  totalMinutes: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatHours(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function analyze(sessions: Session[]): StudyAnalytics {
  const completed = sessions.filter((s) => s.status === "completed");
  const now = new Date();
  const weekStart = startOfWeek(now);
  const todayKey = now.toDateString();

  const week = DAY_LABELS.map((label, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toDateString();
    const minutes = completed
      .filter((s) => new Date(s.date).toDateString() === key)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    return { label, minutes, isToday: key === todayKey };
  });

  const weeklyMinutes = week.reduce((s, d) => s + d.minutes, 0);

  const monthlyMinutes = completed
    .filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const days = new Set(completed.map((s) => new Date(s.date).toDateString()));
  const averageDailyMinutes = days.size
    ? completed.reduce((sum, s) => sum + s.durationMinutes, 0) / days.size
    : 0;

  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    week,
    weeklyMinutes,
    monthlyMinutes,
    averageDailyMinutes,
    streak,
    totalMinutes: completed.reduce((sum, s) => sum + s.durationMinutes, 0),
  };
}
