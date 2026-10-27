import { expect, test, beforeEach } from "bun:test";
import { STARTER_MINUTES, FIRST_COMPLETION_BONUS, shouldShowStarter } from "./starter-session";
import { bindFocusTodo, getFocusTodos, clearFocusTodo, taskForCompletedSession } from "./focus-todo";
const storage = new Map<string, string>();
beforeEach(() => { storage.clear(); Object.assign(globalThis, { localStorage: {
  getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v),
} }); });
test("new-user starter lasts 15 minutes", () => expect(STARTER_MINUTES).toBe(15));
test("first-completion bonus is 50 coins", () => expect(FIRST_COMPLETION_BONUS).toBe(50));
test("starter disappears after first completion, not while history loads", () => {
  expect(shouldShowStarter(true, 0)).toBe(true); expect(shouldShowStarter(true, 1)).toBe(false);
  expect(shouldShowStarter(false, 0)).toBe(false);
});
test("only the linked successful session completes a task", () => {
  const link = { id: "task", text: "Physics", day: "2026-10-27", sessionId: "session" };
  expect(taskForCompletedSession([link], [{ id: "session", status: "failed" }])).toEqual([]);
  expect(taskForCompletedSession([link], [{ id: "other", status: "completed" }])).toEqual([]);
  expect(taskForCompletedSession([link], [{ id: "session", status: "completed" }])).toEqual([link]);
});
test("task links are account-scoped and retries do not duplicate them", () => {
  const link = { id: "task", text: "Physics", day: "2026-10-27", sessionId: "session" };
  bindFocusTodo("one", link); bindFocusTodo("one", link);
  expect(getFocusTodos("two")).toEqual([]); expect(getFocusTodos("one")).toEqual([link]);
  clearFocusTodo("one", "session"); expect(getFocusTodos("one")).toEqual([]);
});