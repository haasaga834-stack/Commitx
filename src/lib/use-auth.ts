import { useEffect, useState } from "react";
import type { Session as SupabaseSession, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { pullFromCloud, startCloudSync, stopCloudSync } from "./cloud-sync";
import { resetState } from "./commitx-store";

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
        void pullFromCloud(session.user.id).catch(() => {});
      } else {
        stopCloudSync();
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
  await supabase.auth.signOut();
  resetState();
}
