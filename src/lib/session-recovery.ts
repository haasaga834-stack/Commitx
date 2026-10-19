import type { ActiveVerifiedSession } from "./verified-mode";

/** Reconcile the earliest boundary before considering terminal completion. */
export function recoverSessionProgress(ticket: ActiveVerifiedSession, now: number): ActiveVerifiedSession {
  if (ticket.pendingFail || (ticket.phase ?? "focus") !== "focus" || ticket.duration <= 120 ||
      (ticket.breaksTaken ?? 0) > 0 || ticket.runningSince == null) return ticket;
  const halfway = ticket.duration * 60_000 / 2;
  const elapsed = (ticket.accumulatedMs ?? 0) + Math.max(0, now - ticket.runningSince);
  if (elapsed < halfway) return ticket;
  const breakStartedAt = ticket.runningSince + Math.max(0, halfway - (ticket.accumulatedMs ?? 0));
  const breakEnd = breakStartedAt + 300_000;
  return { ...ticket, accumulatedMs: halfway, runningSince: null, breakStartedAt,
    phase: now >= breakEnd ? "awaiting_confirmation" : "recovery_break",
    confirmSince: now >= breakEnd ? breakEnd : null };
}