CREATE OR REPLACE FUNCTION public.record_focus_session_from_active(
  _user_id uuid,
  _session_id uuid,
  _requested_status text
)
RETURNS TABLE(session_id uuid, coin_balance integer, accepted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active public.active_sessions%ROWTYPE;
  v_existing public.focus_sessions%ROWTYPE;
  v_spent integer := 0;
  v_earned integer := 0;
  v_bonus integer := 0;
  v_balance integer := 0;
  v_coins_spent integer := 0;
  v_coins_earned integer := 0;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL OR _requested_status NOT IN ('completed', 'failed') THEN
    RETURN QUERY SELECT _session_id, 0, false;
    RETURN;
  END IF;

  SELECT * INTO v_existing
    FROM public.focus_sessions
   WHERE id = _session_id
     AND user_id = _user_id;

  IF FOUND THEN
    SELECT COALESCE(w.coin_balance, 0) INTO v_balance
      FROM public.wallets w
     WHERE w.user_id = _user_id;
    RETURN QUERY SELECT v_existing.id, v_balance, true;
    RETURN;
  END IF;

  SELECT * INTO v_active
    FROM public.active_sessions
   WHERE user_id = _user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    SELECT COALESCE(w.coin_balance, 0) INTO v_balance
      FROM public.wallets w
     WHERE w.user_id = _user_id;
    RETURN QUERY SELECT _session_id, v_balance, false;
    RETURN;
  END IF;

  IF _requested_status = 'completed' AND (
    v_active.status <> 'active'
    OR now() < v_active.started_at + make_interval(mins => v_active.duration_minutes)
  ) THEN
    SELECT COALESCE(w.coin_balance, 0) INTO v_balance
      FROM public.wallets w
     WHERE w.user_id = _user_id;
    RETURN QUERY SELECT _session_id, v_balance, false;
    RETURN;
  END IF;

  SELECT COALESCE(sum(fs.coins_spent), 0), COALESCE(sum(fs.coins_earned), 0)
    INTO v_spent, v_earned
    FROM public.focus_sessions fs
   WHERE fs.user_id = _user_id;

  SELECT COALESCE(sum(r.bonus_amount), 0)
    INTO v_bonus
    FROM public.referrals r
   WHERE r.referrer_id = _user_id OR r.referred_id = _user_id;

  v_balance := GREATEST(0, 300 + v_bonus + v_earned - v_spent);

  IF _requested_status = 'completed' THEN
    v_coins_earned := 25 * floor(GREATEST(0, v_active.duration_minutes)::numeric / 60)::integer;
  ELSIF v_active.value >= 50 THEN
    v_coins_spent := LEAST(v_active.value, v_balance);
  END IF;

  INSERT INTO public.focus_sessions (
    id, user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned, created_at
  ) VALUES (
    _session_id,
    _user_id,
    v_active.goal,
    v_active.duration_minutes,
    v_active.value,
    v_active.mode,
    _requested_status,
    v_coins_spent,
    v_coins_earned,
    v_active.started_at
  );

  v_balance := GREATEST(0, v_balance - v_coins_spent + v_coins_earned);

  INSERT INTO public.wallets (user_id, coin_balance)
  VALUES (_user_id, v_balance)
  ON CONFLICT (user_id) DO UPDATE
    SET coin_balance = EXCLUDED.coin_balance,
        updated_at = now();

  DELETE FROM public.active_sessions WHERE user_id = _user_id;

  RETURN QUERY SELECT _session_id, v_balance, true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_focus_session_from_active(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_focus_session_from_active(uuid, uuid, text) TO service_role;