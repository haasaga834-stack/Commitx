ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_bonus integer;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS seen_by_referrer_at timestamptz;
-- Preserve historical credits exactly (both sides previously earned bonus_amount).
UPDATE public.referrals SET referrer_bonus = bonus_amount, seen_by_referrer_at = COALESCE(seen_by_referrer_at, created_at) WHERE referrer_bonus IS NULL;
ALTER TABLE public.referrals ALTER COLUMN referrer_bonus SET DEFAULT 50;
ALTER TABLE public.referrals ALTER COLUMN referrer_bonus SET NOT NULL;
ALTER TABLE public.referrals ALTER COLUMN bonus_amount SET DEFAULT 100;

CREATE OR REPLACE FUNCTION public.ledger_coin_balance(_user_id uuid)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT GREATEST(0,
      300
    + COALESCE((SELECT sum(r.referrer_bonus) FROM public.referrals r WHERE r.referrer_id = _user_id), 0)
    + COALESCE((SELECT sum(r.bonus_amount) FROM public.referrals r WHERE r.referred_id = _user_id), 0)
    + COALESCE((SELECT sum(a.amount) FROM public.coin_adjustments a WHERE a.user_id = _user_id), 0)
    + COALESCE((SELECT sum(f.coins_earned) FROM public.focus_sessions f WHERE f.user_id = _user_id), 0)
    - COALESCE((SELECT sum(f.coins_spent) FROM public.focus_sessions f WHERE f.user_id = _user_id), 0)
  )::integer
$function$;

-- Clients may never set or change referral fields directly.
CREATE OR REPLACE FUNCTION public.protect_profile_referral_fields()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('commitx.referral_write', true) = 'on' THEN RETURN NEW; END IF;
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.referred_by := NULL;
    ELSE
      NEW.referred_by := OLD.referred_by;
      NEW.referral_code := OLD.referral_code;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS profiles_protect_referral ON public.profiles;
CREATE TRIGGER profiles_protect_referral BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_referral_fields();

CREATE OR REPLACE FUNCTION public.claim_referral(_code text, _device_hash text)
 RETURNS TABLE(ok boolean, message text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_me public.profiles%ROWTYPE;
  v_referrer uuid;
  v_code text := upper(btrim(coalesce(_code, '')));
  v_device text := nullif(left(btrim(coalesce(_device_hash, '')), 128), '');
BEGIN
  IF v_uid IS NULL THEN RETURN QUERY SELECT false, 'Please sign in first.'; RETURN; END IF;
  IF v_code = '' OR length(v_code) > 32 THEN RETURN QUERY SELECT false, 'Enter a valid referral code.'; RETURN; END IF;
  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'Profile not found.'; RETURN; END IF;
  IF v_me.referred_by IS NOT NULL OR EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_uid) THEN
    RETURN QUERY SELECT false, 'A referral code has already been applied to this account.'; RETURN;
  END IF;
  IF v_me.created_at < now() - interval '72 hours' THEN
    RETURN QUERY SELECT false, 'Referral codes can only be used by new accounts.'; RETURN;
  END IF;
  IF upper(v_me.referral_code) = v_code THEN RETURN QUERY SELECT false, 'You cannot use your own referral code.'; RETURN; END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE upper(referral_code) = v_code;
  IF v_referrer IS NULL THEN RETURN QUERY SELECT false, 'That referral code is not valid.'; RETURN; END IF;
  IF v_referrer = v_uid THEN RETURN QUERY SELECT false, 'You cannot use your own referral code.'; RETURN; END IF;
  IF v_device IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.referrals WHERE referred_device_hash = v_device)
       OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_referrer AND device_hash = v_device)) THEN
    RETURN QUERY SELECT false, 'A referral was already claimed on this device.'; RETURN;
  END IF;
  BEGIN
    INSERT INTO public.referrals (referrer_id, referred_id, referred_device_hash, bonus_amount, referrer_bonus)
    VALUES (v_referrer, v_uid, v_device, 100, 50);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'This referral has already been claimed.'; RETURN;
  END;
  PERFORM set_config('commitx.referral_write', 'on', true);
  UPDATE public.profiles SET referred_by = v_referrer, device_hash = coalesce(v_device, device_hash) WHERE id = v_uid;
  PERFORM set_config('commitx.referral_write', 'off', true);
  RETURN QUERY SELECT true, 'Welcome to CommitX! You received 100 bonus CX Coins for joining through a referral.';
END $function$;
REVOKE ALL ON FUNCTION public.claim_referral(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_referral_history()
 RETURNS TABLE(id uuid, direction text, friend_name text, coins integer, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.id, 'referred_friend', coalesce(p.display_name, 'A friend'), r.referrer_bonus, r.created_at
    FROM public.referrals r LEFT JOIN public.profiles p ON p.id = r.referred_id
   WHERE r.referrer_id = auth.uid()
  UNION ALL
  SELECT r.id, 'joined_with_code', coalesce(p.display_name, 'A friend'), r.bonus_amount, r.created_at
    FROM public.referrals r LEFT JOIN public.profiles p ON p.id = r.referrer_id
   WHERE r.referred_id = auth.uid()
  ORDER BY 5 DESC
$function$;
REVOKE ALL ON FUNCTION public.my_referral_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_history() TO authenticated;

CREATE OR REPLACE FUNCTION public.take_unseen_referrals()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE public.referrals SET seen_by_referrer_at = now()
   WHERE referrer_id = auth.uid() AND seen_by_referrer_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.take_unseen_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_unseen_referrals() TO authenticated;