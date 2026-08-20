import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Demo balance granted on sign-up. Must match WELCOME_DEMO in commitx-store. */
const WELCOME_DEMO = 300;
const MIN_COMMIT = 50;
const MAX_COMMIT = 500;

const sessionInput = z.object({
  goal: z.string().trim().min(1).max(80).default("Focus"),
  durationMinutes: z.number().int().min(0).max(600),
  value: z.number().int().min(0).max(MAX_COMMIT),
  mode: z.enum(["standard", "verified"]),
  status: z.enum(["completed", "failed"]),
});

export type SyncedSession = z.infer<typeof sessionInput>;

/**
 * Trusted recording of focus-session outcomes and the resulting wallet balance.
 *
 * The client may only describe *what happened*; the amount deducted and the
 * balance itself are recomputed here from the user's own session ledger plus
 * their referral bonuses, so a forged balance or reward cannot be uploaded.
 */
export const recordSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ sessions: z.array(sessionInput).max(20) }).parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ids: string[]; real: number; demo: number }> => {
      const { userId } = context;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [{ data: existing }, { data: referrals }] = await Promise.all([
        supabaseAdmin
          .from("focus_sessions")
          .select("demo_used, real_used")
          .eq("user_id", userId),
        supabaseAdmin
          .from("referrals")
          .select("bonus_amount, referrer_id, referred_id")
          .or(`referrer_id.eq.${userId},referred_id.eq.${userId}`),
      ]);

      const bonus = (referrals ?? []).reduce(
        (sum, r: { bonus_amount: number | null }) => sum + (r.bonus_amount ?? 0),
        0,
      );
      let demoSpent = (existing ?? []).reduce(
        (sum, r: { demo_used: number | null }) => sum + (r.demo_used ?? 0),
        0,
      );
      let realSpent = (existing ?? []).reduce(
        (sum, r: { real_used: number | null }) => sum + (r.real_used ?? 0),
        0,
      );

      const demoPool = WELCOME_DEMO + bonus;
      const ids: string[] = [];

      for (const s of data.sessions) {
        // Server-side deduction: only a failed commitment costs money, and it
        // can never exceed what the user actually has left (demo first).
        let demoUsed = 0;
        let realUsed = 0;
        if (s.status === "failed" && s.value >= MIN_COMMIT) {
          const demoLeft = Math.max(0, demoPool - demoSpent);
          const realLeft = Math.max(0, 0 - realSpent);
          demoUsed = Math.min(s.value, demoLeft);
          realUsed = Math.min(s.value - demoUsed, realLeft);
          demoSpent += demoUsed;
          realSpent += realUsed;
        }

        const { data: row } = await supabaseAdmin
          .from("focus_sessions")
          .insert({
            user_id: userId,
            goal: s.goal,
            duration_minutes: s.durationMinutes,
            value: s.value,
            mode: s.mode,
            status: s.status,
            demo_used: demoUsed,
            real_used: realUsed,
          })
          .select("id")
          .maybeSingle();
        if (row?.id) ids.push(row.id as string);
      }

      const demo = Math.max(0, demoPool - demoSpent);
      const real = Math.max(0, 0 - realSpent);

      await supabaseAdmin
        .from("wallets")
        .upsert(
          { user_id: userId, real_balance: real, demo_balance: demo },
          { onConflict: "user_id" },
        );

      return { ids, real, demo };
    },
  );
