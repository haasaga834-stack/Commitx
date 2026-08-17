import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * First-time onboarding state, persisted on the user's profile row
 * (`profiles.onboarding_completed`) with a localStorage mirror so the story
 * never flashes twice on the same device while the profile loads.
 */
export function useOnboarding(userId: string | null) {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    } catch {}
  }, [userId]);

  return { needsOnboarding, complete };
}
