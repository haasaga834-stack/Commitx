import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realtime presence: every signed-in, open CommitX tab/app joins one channel.
 * Supabase drops a member automatically when its socket disconnects.
 */
let channel: RealtimeChannel | null = null;
let trackedUser: string | null = null;
let online = new Set<string>();
const listeners = new Set<(s: Set<string>) => void>();

function emit() {
  for (const l of listeners) l(online);
}

function join(userId: string) {
  if (trackedUser === userId && channel) return;
  leave();
  trackedUser = userId;
  const ch = supabase.channel("commitx-online", { config: { presence: { key: userId } } });
  ch.on("presence", { event: "sync" }, () => {
    online = new Set(Object.keys(ch.presenceState()));
    emit();
  }).subscribe((status) => {
    if (status === "SUBSCRIBED") void ch.track({ at: Date.now() });
  });
  channel = ch;
}

function leave() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  trackedUser = null;
  online = new Set();
  emit();
}

/** Mount once at the app root. */
export function usePresenceTracker() {
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) join(data.session.user.id);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) join(session.user.id);
      else leave();
    });
    return () => {
      data.subscription.unsubscribe();
      leave();
    };
  }, []);
}

export function useOnlineUsers() {
  const [set, setSet] = useState<Set<string>>(online);
  useEffect(() => {
    const l = (s: Set<string>) => setSet(new Set(s));
    listeners.add(l);
    l(online);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return set;
}
