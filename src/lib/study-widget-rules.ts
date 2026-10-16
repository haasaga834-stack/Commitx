export type WidgetTrigger = 'daily-goal' | 'todos';
export function shouldInviteWidget(native: boolean, seen: boolean, onboarding: boolean, trigger: WidgetTrigger) {
  return native && !seen && (trigger === 'daily-goal' ? onboarding : !onboarding);
}
export function widgetTasks<T>(tasks: T[]) { return { visible: tasks.slice(0, 3), more: Math.max(0, tasks.length - 3) }; }
