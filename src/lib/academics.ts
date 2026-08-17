import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "./commitx-store";
import { getPlans, type StudyPlan } from "./planner";

/**
 * Academic layer — deliberately tiny: a per-user subject list with an optional
 * exam date and a revision flag. Everything else (progress, targets) is derived
 * from data CommitX already stores (focus sessions, study plans, user settings),
 * so there is no duplicate database and no fabricated statistics.
 */
export interface Subject {
  id: string;
  name: string;
  /** YYYY-MM-DD, optional */
  examDate?: string;
  revised: boolean;
  revisedAt?: number;
  createdAt: number;
}

const KEY = "commitx-academics-v1";

let cloudUserId: string | null = null;
let cache: Subject[] | null = null;
const listeners = new Set<() => void>();

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function read(): Subject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Subject[]) : [];
  } catch {
    return [];
  }
}

function write(subjects: Subject[]) {
  cache = subjects;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(subjects));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export function getSubjects(): Subject[] {
  if (!cache) cache = read();
  return cache;
}

function toRow(s: Subject, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    exam_date: s.examDate ?? null,
    revised: s.revised,
    revised_at: s.revisedAt ? new Date(s.revisedAt).toISOString() : null,
  };
}

export async function addSubject(name: string, examDate?: string): Promise<Subject> {
  const row: Subject = {
    id: newId(),
    name: name.trim(),
    examDate: examDate || undefined,
    revised: false,
    createdAt: Date.now(),
  };
  write([...getSubjects(), row]);
  if (cloudUserId) {
    const { error } = await supabase.from("academic_subjects").insert(toRow(row, cloudUserId));
    if (error) throw error;
  }
  return row;
}

export async function updateSubject(id: string, patch: Partial<Omit<Subject, "id">>) {
  const next = getSubjects().map((s) => (s.id === id ? { ...s, ...patch } : s));
  write(next);
  const row = next.find((s) => s.id === id);
  if (row && cloudUserId) {
    const { error } = await supabase
      .from("academic_subjects")
      .upsert(toRow(row, cloudUserId), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function toggleRevised(id: string) {
  const current = getSubjects().find((s) => s.id === id);
  if (!current) return;
  const revised = !current.revised;
  await updateSubject(id, { revised, revisedAt: revised ? Date.now() : undefined });
}

export async function removeSubject(id: string) {
  write(getSubjects().filter((s) => s.id !== id));
  if (cloudUserId) {
    await supabase.from("academic_subjects").delete().eq("id", id);
  }
}

export function useSubjects() {
  const [, tick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    cache = read();
    setHydrated(true);
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { subjects: getSubjects(), hydrated };
}

/** Attach/detach the signed-in user. Called from useAuth. */
export function setAcademicsUser(userId: string | null) {
  cloudUserId = userId;
  if (!userId) return;
  void pullSubjects(userId).catch(() => {});
}

export function clearAcademicsLocal() {
  cloudUserId = null;
  write([]);
}

async function pullSubjects(userId: string) {
  const { data } = await supabase
    .from("academic_subjects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (!data) return;
  write(
    data.map((r) => ({
      id: r.id,
      name: r.name,
      examDate: r.exam_date ?? undefined,
      revised: r.revised,
      revisedAt: r.revised_at ? new Date(r.revised_at).getTime() : undefined,
      createdAt: new Date(r.created_at).getTime(),
    })),
  );
}

/* ---------------------------------------------------------------------------
 * Derived academic insight — real data only
 * ------------------------------------------------------------------------ */

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** Days left until an exam date (0 = today, negative = past). */
export function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 0) return `${Math.abs(d)} ${Math.abs(d) === 1 ? "day" : "days"} ago`;
  return `${d} days left`;
}

export interface SubjectProgress {
  subject: Subject;
  /** Minutes of successfully completed focus, matched by session goal / plan subject. */
  completedMinutes: number;
  /** Number of completed sessions counted. */
  sessions: number;
  /** Planned minutes per occurrence from the study planner, when a plan exists. */
  plannedMinutes: number | null;
  lastStudied: number | null;
}

/**
 * Matches a subject to real completed sessions. A session counts when its goal
 * text mentions the subject name (sessions are created from planner subjects or
 * a typed goal), so nothing is invented — subjects with no matching sessions
 * report zero and the UI shows an empty state.
 */
export function subjectProgress(
  subjects: Subject[],
  sessions: Session[],
  plans: StudyPlan[] = getPlans(),
): SubjectProgress[] {
  const completed = sessions.filter((s) => s.status === "completed");
  return subjects.map((subject) => {
    const key = norm(subject.name);
    const matches = completed.filter((s) => {
      const goal = norm(s.goal);
      return goal === key || goal.includes(key);
    });
    const plan = plans.find((p) => norm(p.subject) === key);
    return {
      subject,
      completedMinutes: matches.reduce((sum, s) => sum + s.durationMinutes, 0),
      sessions: matches.length,
      plannedMinutes: plan ? plan.durationMinutes : null,
      lastStudied: matches.length ? Math.max(...matches.map((s) => s.date)) : null,
    };
  });
}

/** Subject names already present in the user's study plans, for quick add. */
export function suggestedSubjects(plans: StudyPlan[], subjects: Subject[]): string[] {
  const have = new Set(subjects.map((s) => norm(s.name)));
  const out: string[] = [];
  for (const p of plans) {
    if (p.subject && !have.has(norm(p.subject)) && !out.some((x) => norm(x) === norm(p.subject))) {
      out.push(p.subject);
    }
  }
  return out;
}
