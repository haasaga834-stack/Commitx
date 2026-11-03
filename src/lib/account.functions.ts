import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REFERRAL_REWARD = 100;
export const REFERRER_REWARD = 50;

/**
 * Claim a referral code for the signed-in new account. All validation and the
 * coin ledger write happen atomically in the `claim_referral` database
 * function (new user +100, referrer +50, once per account and device).
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; deviceHash: string }) => ({
    code: String(input.code || "").trim().toUpperCase().slice(0, 32),
    deviceHash: String(input.deviceHash || "").slice(0, 128),
  }))
  .handler(async ({ data, context }) => {
    if (!data.code) return { ok: false as const, message: "Enter a referral code." };
    const { data: rows, error } = await context.supabase.rpc("claim_referral", {
      _code: data.code,
      _device_hash: data.deviceHash,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (error || !row) return { ok: false as const, message: "Could not apply that code. Please try again." };
    return row.ok
      ? { ok: true as const, message: row.message }
      : { ok: false as const, message: row.message };
  });

/** Permanently delete the signed-in user and every record tied to them. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Application records and referral preservation are atomic and retry-safe.
    // Never remove the login if any application-data cleanup failed.
    const { error: cleanupError } = await supabaseAdmin.rpc("delete_account_app_data", { _user_id: userId });
    if (cleanupError) throw new Error("Account deletion could not finish. Please retry.");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
