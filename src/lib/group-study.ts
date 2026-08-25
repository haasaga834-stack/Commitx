import { coinsForMinutes, getState, setState, type Mode } from "./commitx-store";

export * from "./group-study.shared";

/**
 * Record a group session outcome using the exact same commitment rules as an
 * individual session: completing returns the committed Cx Coins and awards the
 * hourly reward, leaving early or failing forfeits the committed Cx Coins.
 */
export function recordGroupOutcome(input: {
  goal: string;
  duration: number;
  value: number;
  mode: Mode;
  status: "completed" | "failed";
}) {
  const current = getState();
  const coinsSpent =
    input.status === "failed" ? Math.min(input.value, current.coins) : 0;
  const coinsEarned =
    input.status === "completed" ? coinsForMinutes(input.duration) : 0;
  const session = {
    id: `${Date.now()}`,
    goal: input.goal,
    durationMinutes: input.duration,
    value: input.value,
    mode: input.mode,
    status: input.status,
    date: Date.now(),
    coinsSpent,
    coinsEarned,
  };
  setState((s) => ({
    ...s,
    sessions: [session, ...s.sessions],
    coins: Math.max(0, s.coins - coinsSpent + coinsEarned),
  }));
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
