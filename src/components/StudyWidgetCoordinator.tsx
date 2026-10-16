import { useEffect, useState } from 'react';
import { subscribe } from '@/lib/commitx-store';
import { subscribePlannerWidget, getTodos, toggleTodo, useTodos } from '@/lib/planner';
import { syncStudyWidget, widgetInvitationSeen, markWidgetInvited } from '@/lib/study-widget';
import { shouldInviteWidget } from '@/lib/study-widget-rules';
import { hasNativeBridge } from '@/lib/native-session';
import { StudyWidgetInvite } from './StudyWidgetInvite';
export function StudyWidgetCoordinator({ userId, onboarding }: { userId: string | null; onboarding: boolean }) {
  const [invite, setInvite] = useState(false);
  const { hydrated } = useTodos();
  useEffect(() => {
    if (!hasNativeBridge() || !hydrated) return;
    function reconcile() {
      if (userId) {
        try {
          const pending = JSON.parse(window.CommitXAndroid?.pendingStudyWidgetTodos?.() ?? '[]') as { id: string; done: boolean; userId: string }[];
          for (const item of pending) {
            if (item.userId !== userId) continue;
            const todo = getTodos().find((t) => t.id === item.id);
            if (todo && todo.done !== item.done) toggleTodo(item.id);
          }
          window.CommitXAndroid?.ackStudyWidgetTodos?.(JSON.stringify(pending));
        } catch {}
      }
      syncStudyWidget(userId);
    }
    reconcile();
    const stopStore = subscribe(() => syncStudyWidget(userId));
    const stopPlanner = subscribePlannerWidget(() => syncStudyWidget(userId));
    const onVisible = () => { if (document.visibilityState === 'visible') reconcile(); };
    const timer = setInterval(reconcile, 60000);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopStore(); stopPlanner(); clearInterval(timer); window.removeEventListener('focus', reconcile); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId, hydrated]);
  useEffect(() => {
    const request = () => {
      if (userId && shouldInviteWidget(hasNativeBridge(), widgetInvitationSeen(userId), onboarding, 'todos')) {
        markWidgetInvited(userId); setInvite(true);
      }
    };
    window.addEventListener('commitx:todos-opened', request);
    return () => window.removeEventListener('commitx:todos-opened', request);
  }, [userId, onboarding]);
  return invite && userId ? <StudyWidgetInvite userId={userId} onDone={() => setInvite(false)} /> : null;
}
