/** Account/session-keyed task links survive offline completion and app restarts. */
export interface FocusTodoLink { id: string; text: string; day: string; sessionId: string; }
const key = (userId: string) => `commitx:focus-todos:${userId}`;
export function getFocusTodos(userId: string): FocusTodoLink[] {
  try { return JSON.parse(localStorage.getItem(key(userId)) ?? "[]"); } catch { return []; }
}
export function bindFocusTodo(userId: string, link: FocusTodoLink) {
  const links = getFocusTodos(userId).filter(item => item.sessionId !== link.sessionId);
  localStorage.setItem(key(userId), JSON.stringify([...links, link]));
}
export function clearFocusTodo(userId: string, sessionId: string) {
  localStorage.setItem(key(userId), JSON.stringify(getFocusTodos(userId).filter(item => item.sessionId !== sessionId)));
}
export function taskForCompletedSession(links: FocusTodoLink[], sessions: { id: string; status: string }[]) {
  return links.filter(link => sessions.some(session => session.id === link.sessionId && session.status === "completed"));
}