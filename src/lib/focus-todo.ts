/**
 * Links one to-do to the next focus session. The link is local only and is
 * consumed once, by the success screen, when that session's goal matches.
 */
const KEY = "commitx:focus-todo";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

export interface FocusTodoLink {
  id: string;
  text: string;
  at: number;
}

export function setFocusTodo(id: string, text: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, text, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function clearFocusTodo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Returns and clears the link if it belongs to a session with this goal. */
export function takeFocusTodo(goal: string, now = Date.now()): FocusTodoLink | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const link = JSON.parse(raw) as FocusTodoLink;
    if (!link?.id || link.text.trim() !== goal.trim() || now - link.at > MAX_AGE_MS) return null;
    localStorage.removeItem(KEY);
    return link;
  } catch {
    return null;
  }
}
