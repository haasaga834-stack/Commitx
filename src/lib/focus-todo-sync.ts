import { supabase } from "@/integrations/supabase/client";
import { completeTodo } from "./planner";
import { getFocusTodos, clearFocusTodo } from "./focus-todo";
const working = new Set<string>();
/** Only a recorded successful outcome can tick a task; links remain durable until acknowledged. */
export async function reconcileFocusTodos(userId: string) {
  if (working.has(userId)) return;
  working.add(userId);
  try {
    for (const link of getFocusTodos(userId)) {
      const { data: session, error } = await supabase.from("focus_sessions").select("status")
        .eq("id", link.sessionId).eq("user_id", userId).maybeSingle();
      if (error || !session) continue;
      if (session.status === "completed") {
        const { data, error: taskError } = await supabase.from("todos").update({ done: true })
          .eq("id", link.id).eq("user_id", userId).eq("day", link.day).select("id");
        if (taskError) continue;
        if (data?.length) completeTodo(link.id);
      }
      clearFocusTodo(userId, link.sessionId);
    }
  } finally { working.delete(userId); }
}