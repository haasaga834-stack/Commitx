import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Trusted recording of focus-session outcomes and the resulting Cx Coin balance.
 *
 * The client supplies only an id, the requested outcome and hints that pick
 * which of the user's own session claims it belongs to. Session terms, elapsed
 * time, rewards, forfeits and the resulting balance come from locked server
 * state in one database transaction; each claim can be recorded only once.
 *
 * Returns:
 *  - ids:      sessions now stored on the server (new or already recorded)
 *  - rejected: sessions the server definitively refused (no matching claim,
 *              not finished, already settled) — the client must drop them
 *  - coins:    the authoritative wallet balance
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
              durationMinutes: z.number().int().min(0).max(720),
              value: z.number().int().min(0).max(500),
              mode: z.enum(["standard", "verified"]),
              status: z.enum(["completed", "failed"]),
              endedAt: z.number().int().positive().optional(),
            }),
          )
          .max(20),
      })
      .parse(data),
  )
  .handler(
    async ({ data, context }): Promise<{ ids: string[]; rejected: string[]; retryable: string[]; coins: number }> => {
      const { userId } = context;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const ids: string[] = [];
      const rejected: string[] = [];
      const retryable: string[] = [];
      let coins: number | null = null;

      for (const s of data.sessions) {
        if (!s.id) continue;
        const { data: rows, error } = await supabaseAdmin.rpc(
          "record_focus_session_from_active",
          {
            _user_id: userId,
            _session_id: s.id,
            _requested_status: s.status,
            _duration_minutes: s.durationMinutes,
            _value: s.value,
            _mode: s.mode,
            ...(s.endedAt ? { _ended_at: new Date(s.endedAt).toISOString() } : {}),
          },
        );
        if (error) throw new Error("Could not securely record this session.");
        const row = Array.isArray(rows) ? rows[0] : null;
        if (row?.accepted) ids.push(row.session_id as string);
        else {
          // A claim created by the server clock can still be a few seconds
          // short of completion. Do not discard its durable local outcome.
          const { data: active, error: activeError } = await context.supabase
            .from("active_sessions").select("started_at,duration_minutes,value,mode,status")
            .eq("user_id", userId).maybeSingle();
          if (activeError) throw new Error("Could not check session recording status.");
          if (s.status === "completed" && active?.status === "active" &&
            active.duration_minutes === s.durationMinutes && active.value === s.value && active.mode === s.mode &&
            Date.now() < new Date(active.started_at).getTime() + active.duration_minutes * 60_000) {
            retryable.push(s.id);
          } else rejected.push(s.id);
        }
        if (typeof row?.coin_balance === "number") coins = row.coin_balance;
      }

      if (coins === null) {
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from("wallets")
          .select("coin_balance")
          .eq("user_id", userId)
          .maybeSingle();
        if (walletError || !wallet) throw new Error("Could not read the recorded coin balance.");
        coins = wallet.coin_balance;
      }

      return { ids, rejected, retryable, coins };
    },
  );
