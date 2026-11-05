import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, onReconnect } from "./connectivity";

const localKey = (uid: string) => `commitx-onboarding-v1:${uid}`;

function readLocal(uid: string) {
  try {
    return localStorage.getItem(localKey(uid)) === "done";
  } catch {
    return false;
  }
}

function writeLocal(uid: string) {
  try {
    localStorage.setItem(localKey(uid), "done");
  } catch {}
}

const pendingKey = (uid: string) => `commitx-onboarding-pending:${uid}`;
async function syncCompletion(uid: string) {
  if (!isOnline() || localStorage.getItem(pendingKey(uid)) !== "1") return;
  const { data, error } = await supabase.from("profiles")
    .update({ onboarding_completed: true }).eq("id", uid).select("id");
  if (!error && data?.some(row => row.id === uid)) localStorage.removeItem(pendingKey(uid));
}

/**
 * First-time onboarding state, persisted on the user's profile row
 * (`profiles.onboarding_completed`) with a localStorage mirror so the story
 * never flashes twice on the same device while the profile loads.
 */
export function useOnboarding(userId: string | null) {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const retry = () => { void syncCompletion(userId).catch(() => {}); };
    retry();
    const stop = onReconnect(retry);
    const timer = window.setInterval(retry, 30_000);
    return () => { stop(); window.clearInterval(timer); };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNeedsOnboarding(false);
      return;
    }
    let active = true;
    if (readLocal(userId)) {
      setNeedsOnboarding(false);
      return;
    }
    void supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error) return;
        const done = data?.onboarding_completed ?? false;
        if (done) writeLocal(userId);
        setNeedsOnboarding(!done);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const complete = useCallback(async () => {
    setNeedsOnboarding(false);
    if (!userId) return;
    writeLocal(userId);
    try {
      localStorage.setItem(pendingKey(userId), "1");
      await syncCompletion(userId);
    } catch {}
  }, [userId]);

  return { needsOnboarding, complete };
}
