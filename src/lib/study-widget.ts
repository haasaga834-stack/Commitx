import { getDailyGoalHours, getTodos, todayKey } from './planner';
import { getState, stats } from './commitx-store';
import { supabase } from '@/integrations/supabase/client';

const localKey = (userId: string) => `commitx-widget-invited:${userId}`;

export function widgetInvitationSeen(userId: string) {
  try { return Boolean(window.CommitXAndroid?.studyWidgetInvitationSeen?.(userId)) || localStorage.getItem(localKey(userId)) === '1'; } catch { return true; }
}

/** Account copy prevents the invitation returning after reinstalling or changing phones. */
export async function loadWidgetInvitation(userId: string) {
  if (widgetInvitationSeen(userId)) return true;
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
  void supabase.from('user_settings').upsert({ user_id: userId, study_widget_invited: true }, { onConflict: 'user_id' });
}

export function syncStudyWidget(userId: string | null) {
  try { window.CommitXAndroid?.syncStudyWidget?.(JSON.stringify({ userId, day: todayKey(), minutes: userId ? stats(getState().sessions).todayMinutes : 0, goalMinutes: getDailyGoalHours() * 60, todos: userId ? getTodos() : [] })); } catch {}
}

export function requestStudyWidget() {
  try { return window.CommitXAndroid?.requestStudyWidget?.() ?? false; } catch { return false; }
}
