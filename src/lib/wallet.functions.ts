import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Cx Coins granted on sign-up. Must match WELCOME_COINS in commitx-store. */
const WELCOME_COINS = 300;
const MIN_COMMIT = 50;
const MAX_COMMIT = 500;
/** Cx Coins earned per fully completed study hour. */
const COINS_PER_HOUR = 25;

const sessionInput = z.object({
  goal: z.string().trim().min(1).max(80).default("Focus"),
  durationMinutes: z.number().int().min(0).max(600),
  value: z.number().int().min(0).max(MAX_COMMIT),
  mode: z.enum(["standard", "verified"]),
  status: z.enum(["completed", "failed"]),
});

export type SyncedSession = z.infer<typeof sessionInput>;

function rewardFor(minutes: number) {
  return COINS_PER_HOUR * Math.floor(Math.max(0, minutes) / 60);
}

/**
 * Trusted recording of focus-session outcomes and the resulting Cx Coin balance.
 *
 * The client may only describe *what happened*; the coins spent and earned and
 * the balance itself are recomputed here from the user's own session ledger plus
 * their referral rewards, so a forged balance or reward cannot be uploaded.
 */
export const recordSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ sessions: z.array(sessionInput).max(20) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ids: string[]; coins: number }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: existing }, { data: referrals }] = await Promise.all([
      supabaseAdmin
        .from("focus_sessions")
        .select("coins_spent, coins_earned")
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
    let spent = (existing ?? []).reduce(
      (sum, r: { coins_spent: number | null }) => sum + (r.coins_spent ?? 0),
      0,
    );
    let earned = (existing ?? []).reduce(
      (sum, r: { coins_earned: number | null }) => sum + (r.coins_earned ?? 0),
      0,
    );

    const ids: string[] = [];

    for (const s of data.sessions) {
      // Server-side ledger: a failed commitment forfeits coins (never more than
      // the user actually holds); a completed one earns coins per whole hour.
      let coinsSpent = 0;
      let coinsEarned = 0;
      const available = Math.max(0, WELCOME_COINS + bonus + earned - spent);
      if (s.status === "failed" && s.value >= MIN_COMMIT) {
        coinsSpent = Math.min(s.value, available);
        spent += coinsSpent;
      } else if (s.status === "completed") {
        coinsEarned = rewardFor(s.durationMinutes);
        earned += coinsEarned;
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
          coins_spent: coinsSpent,
          coins_earned: coinsEarned,
        })
        .select("id")
        .maybeSingle();
      if (row?.id) ids.push(row.id as string);
    }

    const coins = Math.max(0, WELCOME_COINS + bonus + earned - spent);

    await supabaseAdmin
      .from("wallets")
      .upsert({ user_id: userId, coin_balance: coins }, { onConflict: "user_id" });

    return { ids, coins };
  });

