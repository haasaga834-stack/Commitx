import { getDailyGoalHours, getTodos, todayKey } from './planner';
import { getState, stats } from './commitx-store';
import { challengeProgress, getChallenge } from './challenge';
import { readRestorableActiveSession } from './verified-mode';
import { supabase } from '@/integrations/supabase/client';

const localKey = (userId: string) => `commitx-widget-invited:${userId}`;

export function widgetInvitationSeen(userId: string) {
  try { return Boolean(window.CommitXAndroid?.studyWidgetInvitationSeen?.(userId)) || localStorage.getItem(localKey(userId)) === '1'; } catch { return true; }
}

/** Account copy prevents the invitation returning after reinstalling or changing phones. */
export async function loadWidgetInvitation(userId: string) {
  if (widgetInvitationSeen(userId)) { markWidgetInvited(userId); return true; }
  const { data, error } = await supabase.from('user_settings').select('study_widget_invited').eq('user_id', userId).maybeSingle();
  if (error) return true;
  if (data?.study_widget_invited) markWidgetInvitedLocal(userId);
  return Boolean(data?.study_widget_invited);
}

function markWidgetInvitedLocal(userId: string) {
  try { window.CommitXAndroid?.markStudyWidgetInvited?.(userId); localStorage.setItem(localKey(userId), '1'); } catch {}
}

export function markWidgetInvited(userId: string) {
  markWidgetInvitedLocal(userId);
  void supabase.from('user_settings').upsert({ user_id: userId, study_widget_invited: true }, { onConflict: 'user_id' }).then(() => {});
}

export function syncStudyWidget(userId: string | null) {
  try { window.CommitXAndroid?.syncStudyWidget?.(JSON.stringify({ userId, day: todayKey(), minutes: userId ? stats(getState().sessions).todayMinutes : 0, streak: userId ? stats(getState().sessions).streak : 0, goalMinutes: getDailyGoalHours() * 60, challengeDay: userId ? challengeDayFor(userId) : 0, todos: userId ? getTodos() : [], ...liveSession(userId) })); } catch {}
}

export function requestStudyWidget() {
  // True means the launcher supports a pin request, not that the user accepted it.
  try { return window.CommitXAndroid?.requestStudyWidget?.() ?? false; } catch { return false; }
}

function challengeDayFor(userId: string) {
  const rec = getChallenge(userId);
  if (!rec) return 0;
  const p = challengeProgress(rec, getState().sessions);
  return p.status === 'active' ? p.day : 0;
}

/** Live session projection for the widget; presentation only, never settles anything. */
export function liveSession(userId: string | null) {
  if (!userId) return {};
  try {
    const s = readRestorableActiveSession();
    if (!s || typeof s.startedAt !== 'number') return {};
    const endMs = s.startedAt + s.duration * 60000;
    if (endMs <= Date.now()) return {};
    return { sessionStartMs: s.startedAt, sessionEndMs: endMs, sessionGoal: s.goal };
  } catch { return {}; }
}
