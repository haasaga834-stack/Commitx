/** Notification-only projection. Never changes the session or its outcome. */
export interface VerifiedCountdownPayload {
  id: string;
  goal: string;
  theme: string;
  durationMs: number;
  remainingMs: number;
  running: boolean;
  phase: "focus" | "recovery_break" | "awaiting_confirmation";
  breakEndsAt: number | null;
  breakAt: number | null;
}

export function countdownPayload(input: VerifiedCountdownPayload, now: number) {
  const remainingMs = Math.max(0, Math.min(input.durationMs, input.remainingMs));
  return {
    ...input,
    remainingMs,
    endsAt: input.running && input.phase === "focus" ? now + remainingMs : null,
  };
}