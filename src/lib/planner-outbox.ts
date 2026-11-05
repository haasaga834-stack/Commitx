export type PlannerWrite = {
  id: string;
  table: "study_plans" | "todos" | "user_settings";
  remove?: boolean;
  row: Record<string, unknown>;
};

export function readPlannerWrites(userId: string): PlannerWrite[] {
  try { return JSON.parse(localStorage.getItem(`commitx-planner-pending:${userId}`) || "[]"); }
  catch { return []; }
}

export function queuePlannerWrite(userId: string, write: PlannerWrite) {
  const writes = readPlannerWrites(userId);
  // Preserve order and unique revisions so acknowledging an old request cannot erase a newer edit.
  localStorage.setItem(`commitx-planner-pending:${userId}`, JSON.stringify([...writes, write]));
}

export function ackPlannerWrite(userId: string, id: string) {
  localStorage.setItem(`commitx-planner-pending:${userId}`, JSON.stringify(readPlannerWrites(userId).filter(w => w.id !== id)));
}