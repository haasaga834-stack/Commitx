import { useEffect, useState } from 'react';
import { subscribe } from '@/lib/commitx-store';
import { subscribePlannerWidget, getTodos, toggleTodo, useTodos, todayKey } from '@/lib/planner';
import { supabase } from '@/integrations/supabase/client';
import { syncStudyWidget, loadWidgetInvitation, markWidgetInvited } from '@/lib/study-widget';
import { shouldInviteWidget, widgetActionsForUser } from '@/lib/study-widget-rules';
import { hasNativeBridge } from '@/lib/native-session';
import { StudyWidgetInvite } from './StudyWidgetInvite';
import { reconcileFocusTodos } from '@/lib/focus-todo-sync';
export function StudyWidgetCoordinator({ userId, onboarding }: { userId: string | null; onboarding: boolean }) {
  const [invite, setInvite] = useState(false);
  const { hydrated } = useTodos();
  useEffect(() => {
    if (!userId) return;
    const reconcile = () => void reconcileFocusTodos(userId);
    reconcile();
    const stop = subscribe(reconcile);
    const timer = setInterval(reconcile, 15000);
    window.addEventListener('online', reconcile);
    window.addEventListener('focus', reconcile);
    return () => { stop(); clearInterval(timer); window.removeEventListener('online', reconcile); window.removeEventListener('focus', reconcile); };
  }, [userId]);
  useEffect(() => {
    if (!hasNativeBridge() || !hydrated) return;
    let reconciling = false;
    let active = true;
    async function reconcile() {
      if (reconciling || !active) return;
      reconciling = true;
      if (userId) {
        try {
          const pending = JSON.parse(window.CommitXAndroid?.pendingStudyWidgetTodos?.() ?? '[]') as { id: string; done: boolean; userId: string; day: string }[];
          const applied: typeof pending = [];
          for (const item of widgetActionsForUser(pending, userId)) {
            // Persist desired state, not a toggle: retries never invert a completed task.
            // Yesterday's checkbox still reaches its own row after midnight.
            const { data, error } = await supabase.from('todos').update({ done: item.done })
              .eq('id', item.id).eq('user_id', userId).eq('day', item.day).select('id');
            if (!active) return;
            if (error || !data?.length) continue;
            if (item.day === todayKey()) {
              const todo = getTodos().find((t) => t.id === item.id);
              if (todo && todo.done !== item.done) toggleTodo(item.id);
            }
            applied.push(item);
          }
          window.CommitXAndroid?.ackStudyWidgetTodos?.(JSON.stringify(applied));
        } catch {}
      }
      if (active) syncStudyWidget(userId);
      reconciling = false;
    }
    reconcile();
    const stopStore = subscribe(() => syncStudyWidget(userId));
    const stopPlanner = subscribePlannerWidget(() => syncStudyWidget(userId));
    const onVisible = () => { if (document.visibilityState === 'visible') reconcile(); };
    const timer = setInterval(reconcile, 60000);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; stopStore(); stopPlanner(); clearInterval(timer); window.removeEventListener('focus', reconcile); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId, hydrated]);
  useEffect(() => {
    let active = true;
    let requesting = false;
    const request = async () => {
      if (!userId || !hasNativeBridge() || requesting) return;
      requesting = true;
      const seen = await loadWidgetInvitation(userId);
      if (active && shouldInviteWidget(true, seen, onboarding, 'todos')) {
        markWidgetInvited(userId); setInvite(true);
      }
      requesting = false;
    };
    const onOpened = () => void request();
    window.addEventListener('commitx:todos-opened', onOpened);
    return () => { active = false; window.removeEventListener('commitx:todos-opened', onOpened); };
  }, [userId, onboarding]);
  return invite && userId ? <StudyWidgetInvite userId={userId} onDone={() => setInvite(false)} /> : null;
}
