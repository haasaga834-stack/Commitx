import type { User } from "@supabase/supabase-js";

const KEY = "commitx-last-user-v1";

type CachedUser = Pick<User, "id" | "email" | "user_metadata" | "app_metadata"> & {
  cachedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCachedUser(): User | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedUser>;
    if (!parsed || typeof parsed.id !== "string" || !parsed.id) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      user_metadata: parsed.user_metadata ?? {},
      app_metadata: parsed.app_metadata ?? {},
    } as User;
  } catch {
    return null;
  }
}

export function writeCachedUser(user: User) {
  if (!canUseStorage()) return;
  try {
    const cached: CachedUser = {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata ?? {},
      app_metadata: user.app_metadata ?? {},
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {}
}

export function clearCachedUser() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
/**
 * True when this browser holds a Supabase auth token, even if the lightweight
 * user cache is missing. Used to show a quiet splash instead of flashing the
 * public landing page while the session is being restored.
 */
export function hasStoredAuthSession() {
  if (!canUseStorage()) return false;
  try {
    if (window.localStorage.getItem(KEY)) return true;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
