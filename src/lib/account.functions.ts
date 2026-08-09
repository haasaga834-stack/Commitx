import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REFERRAL_REWARD = 100;

/**
 * Claim a referral code. Rewards the referrer with ₹100 demo balance,
 * exactly once per referred user. Enforces:
 *  - caller must not already be referred
 *  - code must exist and belong to another account (no self-referral)
 *  - one reward per referred user (unique referred_id)
 *  - one reward per device fingerprint (unique referred_device_hash)
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; deviceHash: string }) => ({
    code: String(input.code || "").trim().toUpperCase(),
    deviceHash: String(input.deviceHash || "").slice(0, 128),
  }))
  .handler(async ({ data, context }) => {
    if (!data.code) return { ok: false as const, message: "Enter a referral code." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("id, referred_by, referral_code, created_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (!me) return { ok: false as const, message: "Profile not found." };
    if (me.referred_by) return { ok: false as const, message: "You already used a referral code." };
    if (me.referral_code === data.code)
      return { ok: false as const, message: "You cannot refer yourself." };

    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", data.code)
      .maybeSingle();

    if (!referrer) return { ok: false as const, message: "That referral code is not valid." };
    if (referrer.id === context.userId)
      return { ok: false as const, message: "You cannot refer yourself." };

    // One reward per device: block a second account created on the same device.
    if (data.deviceHash) {
      const { data: usedDevice } = await supabaseAdmin
        .from("referrals")
        .select("id")
        .eq("referred_device_hash", data.deviceHash)
        .maybeSingle();
      if (usedDevice)
        return { ok: false as const, message: "A referral was already claimed on this device." };
    }

    const { error: insertError } = await supabaseAdmin.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: context.userId,
      referred_device_hash: data.deviceHash || null,
      bonus_amount: REFERRAL_REWARD,
    });

    if (insertError) {
      return { ok: false as const, message: "This referral has already been claimed." };
    }

    await supabaseAdmin
      .from("profiles")
      .update({ referred_by: referrer.id, device_hash: data.deviceHash || null })
      .eq("id", context.userId);

    // Both sides earn ₹100 demo balance, once.
    const { data: wallets } = await supabaseAdmin
      .from("wallets")
      .select("user_id, demo_balance")
      .in("user_id", [referrer.id, context.userId]);

    const balanceOf = (id: string) =>
      wallets?.find((w) => w.user_id === id)?.demo_balance ?? 0;

    await supabaseAdmin.from("wallets").upsert(
      [
        { user_id: referrer.id, demo_balance: balanceOf(referrer.id) + REFERRAL_REWARD },
        { user_id: context.userId, demo_balance: balanceOf(context.userId) + REFERRAL_REWARD },
      ],
      { onConflict: "user_id" },
    );

    return {
      ok: true as const,
      message: "Referral applied. You and your friend each earned ₹100 demo balance.",
    };
  });

/** Permanently delete the signed-in user and every record tied to them. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    await supabaseAdmin.from("focus_sessions").delete().eq("user_id", userId);
    await supabaseAdmin.from("referrals").delete().eq("referred_id", userId);
    await supabaseAdmin.from("referrals").delete().eq("referrer_id", userId);
    await supabaseAdmin.from("profiles").update({ referred_by: null }).eq("referred_by", userId);
    await supabaseAdmin.from("wallets").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
