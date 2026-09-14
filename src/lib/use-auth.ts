import { useEffect, useState } from "react";
import type { Session as SupabaseSession, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { pullFromCloud, startCloudSync, stopCloudSync } from "./cloud-sync";
import { resetState } from "./commitx-store";
import { clearPlannerLocal, setPlannerUser } from "./planner";
import { clearAcademicsLocal, setAcademicsUser } from "./academics";
import { claimPendingReferral } from "./pending-referral";
import { clearCachedUser, readCachedUser, writeCachedUser } from "./auth-cache";
import { isOnline, onReconnect, startConnectivityWatch } from "./connectivity";

export function useAuth() {
  // Keep the server and first browser render identical. The cached user is
  // restored immediately inside the effect instead of during render, avoiding
  // an authentication-gate hydration mismatch.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const cachedAtStart = readCachedUser();
    if (cachedAtStart) {
      setUser(cachedAtStart);
      setLoading(false);
    }

    const handle = (session: SupabaseSession | null, allowCached = false) => {
      if (!mounted) return;
      const cached = allowCached ? readCachedUser() : null;
      const nextUser = session?.user ?? cached;
      setUser(nextUser ?? null);
      setLoading(false);
      if (nextUser) {
        writeCachedUser(nextUser);
        startCloudSync(nextUser.id);
        setPlannerUser(nextUser.id);
        setAcademicsUser(nextUser.id);
        if (session?.user && isOnline()) {
          const uid = session.user.id;
          void claimPendingReferral()
            .then(() => pullFromCloud(uid))
            .catch(() => {});
        }
      } else {
        clearCachedUser();
        stopCloudSync();
        setPlannerUser(null);
        setAcademicsUser(null);
      }
    };

    startConnectivityWatch();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        handle(session);
      }
      if (event === "SIGNED_OUT") handle(null, !isOnline());
    });

    const stopReconnect = onReconnect(() => {
      void supabase.auth.getSession()
        .then(({ data }) => handle(data.session))
        .catch(() => {});
    });

    supabase.auth.getSession()
      .then(({ data }) => handle(data.session, !isOnline()))
      .catch(() => {
        // Offline / unreachable backend: keep the last known signed-in user.
        handle(null, true);
      });

    // Safety net so a stalled network request can never leave first-time users
    // on the blank startup spinner. Returning users skip this through the cache.
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1200);

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      stopReconnect();
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export async function signOutEverywhere() {
  stopCloudSync();
  clearCachedUser();
  const { nativeGoogleSignOut } = await import("@/lib/native-auth");
  nativeGoogleSignOut();
  await supabase.auth.signOut();
  resetState();
  clearPlannerLocal();
  clearAcademicsLocal();
}

