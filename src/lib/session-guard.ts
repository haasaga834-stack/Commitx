import { supabase } from "@/integrations/supabase/client";

/**
 * True only when the browser holds a live sign-in for this exact user.
 * An expired token (common after a long backgrounded session, when the
 * browser paused auto-refresh) is refreshed first so finished sessions still
 * save instead of silently waiting in a queue.
 */
export async function hasLiveSession(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    let s = data.session;
    if (!s?.access_token || s.user?.id !== userId) return false;
    if (s.expires_at && s.expires_at * 1000 < Date.now() + 30_000) {
      const refreshed = await supabase.auth.refreshSession();
      s = refreshed.data.session;
      if (!s?.access_token || s.user?.id !== userId) return false;
    }
    return true;
  } catch {
    return false;
  }
}
