import { getState, planDeduction, setState, type Mode } from "./commitx-store";

export * from "./group-study.shared";

/**
 * Record a group session outcome using the exact same commitment rules as an
 * individual session: completing returns the earmarked value, leaving early or
 * failing deducts it (demo first, then real).
 */
export function recordGroupOutcome(input: {
  goal: string;
  duration: number;
  value: number;
  mode: Mode;
  status: "completed" | "failed";
}) {
  const current = getState();
  const plan = planDeduction(input.value, current.balances, false);
  const demoUsed = plan.ok ? plan.demoUsed : 0;
  const realUsed = plan.ok ? plan.realUsed : 0;
  const session = {
    id: `${Date.now()}`,
    goal: input.goal,
    durationMinutes: input.duration,
    value: input.value,
    mode: input.mode,
    status: input.status,
    date: Date.now(),
    demoUsed,
    realUsed,
  };
  setState((s) => {
    if (input.status === "completed") {
      return { ...s, sessions: [session, ...s.sessions] };
    }
    return {
      ...s,
      sessions: [session, ...s.sessions],
      balances: {
        demo: Math.max(0, s.balances.demo - demoUsed),
        real: Math.max(0, s.balances.real - realUsed),
      },
    };
  });
}

/** Human label for a participant's state. */
export function memberStatusLabel(status: string) {
  switch (status) {
    case "committed":
      return "Committed";
    case "joined":
      return "Focusing";
    case "completed":
      return "Finished";
    case "failed":
      return "Lost commitment";
    case "left":
      return "Left early";
    case "expired":
      return "Timed out";
    default:
      return status;
  }
}
