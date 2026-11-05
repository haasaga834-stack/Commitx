import { beforeEach, expect, test } from "bun:test";
import { ackPlannerWrite, queuePlannerWrite, readPlannerWrites } from "./planner-outbox";

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  Object.assign(globalThis, { localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  } });
});
test("offline task writes remain durable and owner-scoped after rereading storage", () => {
  queuePlannerWrite("a", { id: "1", table: "todos", row: { id: "task", day: "2026-11-04", done: true } });
  expect(readPlannerWrites("b")).toEqual([]);
  expect(readPlannerWrites("a")[0].row).toEqual({ id: "task", day: "2026-11-04", done: true });
});
test("acknowledging an older goal edit preserves the newer offline goal", () => {
  queuePlannerWrite("a", { id: "1", table: "user_settings", row: { daily_goal_hours: 3 } });
  queuePlannerWrite("a", { id: "2", table: "user_settings", row: { daily_goal_hours: 6 } });
  ackPlannerWrite("a", "1");
  expect(readPlannerWrites("a")).toEqual([{ id: "2", table: "user_settings", row: { daily_goal_hours: 6 } }]);
});