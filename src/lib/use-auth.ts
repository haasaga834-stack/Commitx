import { useEffect, useState } from "react";
import type { Session as SupabaseSession, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { pullFromCloud, startCloudSync, stopCloudSync } from "./cloud-sync";
import { resetState } from "./commitx-store";
import { clearPlannerLocal, setPlannerUser } from "./planner";
import { claimPendingReferral } from "./pending-referral";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const handle = (session: SupabaseSession | null) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        startCloudSync(session.user.id);
        setPlannerUser(session.user.id);
        const uid = session.user.id;
        void claimPendingReferral()
          .then(() => pullFromCloud(uid))
          .catch(() => {});
      } else {
        stopCloudSync();
        setPlannerUser(null);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        handle(session);
      }
    });

    supabase.auth.getSession().then(({ data }) => handle(data.session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export async function signOutEverywhere() {
  stopCloudSync();
  const { nativeGoogleSignOut } = await import("@/lib/native-auth");
  nativeGoogleSignOut();
  await supabase.auth.signOut();
  resetState();
  clearPlannerLocal();
}

