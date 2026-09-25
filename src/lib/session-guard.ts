import { supabase } from "@/integrations/supabase/client";

/**
 * True only when the browser holds a live sign-in for this exact user.
 * Cloud sync uses it so an expired/removed login never issues anonymous
 * requests that the database rejects. Local data stays queued instead.
 */
export async function hasLiveSession(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s?.access_token || s.user?.id !== userId) return false;
    if (s.expires_at && s.expires_at * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
