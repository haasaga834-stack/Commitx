import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Trusted recording of focus-session outcomes and the resulting Cx Coin balance.
 *
 * The client supplies only an id and requested outcome. Session terms, elapsed
 * time, rewards, forfeits and the resulting balance come from locked server
 * state in one database transaction.
 */
export const recordSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sessions: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              goal: z.string().trim().min(1).max(80).default("Focus"),
              durationMinutes: z.number().int().min(0).max(600),
              value: z.number().int().min(0).max(500),
              mode: z.enum(["standard", "verified"]),
              status: z.enum(["completed", "failed"]),
            }),
          )
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ids: string[]; coins: number }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids: string[] = [];
    let coins = 0;

    for (const s of data.sessions) {
      if (!s.id) continue;
      const { data: rows, error } = await supabaseAdmin.rpc(
        "record_focus_session_from_active",
        {
          _user_id: userId,
          _session_id: s.id,
          _requested_status: s.status,
        },
      );
      if (error) throw new Error("Could not securely record this session.");
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.accepted) ids.push(row.session_id as string);
      if (typeof row?.coin_balance === "number") coins = row.coin_balance;
    }

    if (ids.length === 0) {
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("coin_balance")
        .eq("user_id", userId)
        .maybeSingle();
      coins = wallet?.coin_balance ?? 0;
    }

    return { ids, coins };
  });

