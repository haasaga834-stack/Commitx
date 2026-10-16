import { getDailyGoalHours, getTodos, todayKey } from './planner';
import { getState, stats } from './commitx-store';
export function widgetInvitationSeen(userId: string) {
  try { return window.CommitXAndroid?.studyWidgetInvitationSeen?.(userId) ?? localStorage.getItem(`commitx-widget-invited:${userId}`) === '1'; } catch { return true; }
}
export function markWidgetInvited(userId: string) {
  try { window.CommitXAndroid?.markStudyWidgetInvited?.(userId); localStorage.setItem(`commitx-widget-invited:${userId}`, '1'); } catch {}
}
export function syncStudyWidget(userId: string | null) {
  try { window.CommitXAndroid?.syncStudyWidget?.(JSON.stringify({ userId, day: todayKey(), minutes: userId ? stats(getState().sessions).todayMinutes : 0, goalMinutes: getDailyGoalHours() * 60, todos: userId ? getTodos() : [] })); } catch {}
}
export function requestStudyWidget() {
  try { return window.CommitXAndroid?.requestStudyWidget?.() ?? false; } catch { return false; }
}
