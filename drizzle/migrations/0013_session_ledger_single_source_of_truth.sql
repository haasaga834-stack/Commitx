-- =====================================================================
-- CommitX: completed sessions are the single source of truth for focus
-- time, Cx Coins and the leaderboard.
-- =====================================================================

-- 1. Ended session claims are archived (never lost) so a completion that
--    reaches the server late can still be recorded exactly once.
CREATE TABLE public.session_claims_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL DEFAULT 'Focus',
  duration_minutes integer NOT NULL,
  value integer NOT NULL DEFAULT 0,
  mode text NOT NULL,
  started_at timestamptz NOT NULL,
  status text NOT NULL,
  failure_reason text,
  platform text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_session_id uuid
);
GRANT ALL ON public.session_claims_archive TO service_role;
ALTER TABLE public.session_claims_archive ENABLE ROW LEVEL SECURITY;
CREATE INDEX session_claims_archive_lookup
  ON public.session_claims_archive (user_id, started_at DESC)
  WHERE consumed_at IS NULL;

-- 2. Explicit coin adjustments (legacy balances, kept referral bonuses).
CREATE TABLE public.coin_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_adjustments TO authenticated;
GRANT ALL ON public.coin_adjustments TO service_role;
ALTER TABLE public.coin_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_adjustments_select_own ON public.coin_adjustments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coin_adjustments_user ON public.coin_adjustments (user_id);

-- 3. Exact duplicate session rows (same user, same start millisecond, same
--    terms) are moved to an archive, never destroyed.
CREATE TABLE public.focus_sessions_duplicates_archive (
  id uuid PRIMARY KEY,
  kept_session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  goal text NOT NULL,
  duration_minutes integer NOT NULL,
  value integer NOT NULL,
  mode text NOT NULL,
  status text NOT NULL,
  coins_spent integer NOT NULL,
  coins_earned integer NOT NULL,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.focus_sessions_duplicates_archive TO service_role;
ALTER TABLE public.focus_sessions_duplicates_archive ENABLE ROW LEVEL SECURITY;

WITH ranked AS (
  SELECT f.*,
         row_number() OVER w AS rn,
         first_value(f.id) OVER w AS keep_id
    FROM public.focus_sessions f
   WHERE (extract(microseconds FROM f.created_at)::bigint % 1000) = 0
     AND NOT EXISTS (
       SELECT 1 FROM public.group_members m
        WHERE m.user_id = f.user_id AND m.settled_at = f.created_at
     )
  WINDOW w AS (
    PARTITION BY f.user_id, f.created_at, f.goal, f.duration_minutes, f.value,
                 f.mode, f.status, f.coins_spent, f.coins_earned
    ORDER BY f.id
  )
)
INSERT INTO public.focus_sessions_duplicates_archive
  (id, kept_session_id, user_id, goal, duration_minutes, value, mode, status,
   coins_spent, coins_earned, created_at)
SELECT id, keep_id, user_id, goal, duration_minutes, value, mode, status,
       coins_spent, coins_earned, created_at
  FROM ranked WHERE rn > 1;

DELETE FROM public.focus_sessions f
 USING public.focus_sessions_duplicates_archive d
 WHERE f.id = d.id;

-- 4. Structural guard: one recorded row per session claim.
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_user_source_key
  ON public.focus_sessions (user_id, source_key)
  WHERE source_key IS NOT NULL;

-- 5. Wallet = ledger. Preserve every current balance by recording the legacy
--    difference as an explicit adjustment (nobody gains or loses coins).
INSERT INTO public.coin_adjustments (user_id, amount, reason)
SELECT w.user_id,
       w.coin_balance - (
         300
         + COALESCE((SELECT sum(r.bonus_amount) FROM public.referrals r
                      WHERE r.referrer_id = w.user_id OR r.referred_id = w.user_id), 0)
         + COALESCE((SELECT sum(f.coins_earned) FROM public.focus_sessions f WHERE f.user_id = w.user_id), 0)
         - COALESCE((SELECT sum(f.coins_spent) FROM public.focus_sessions f WHERE f.user_id = w.user_id), 0)
       ),
       'legacy_balance_reconciliation'
  FROM public.wallets w
 WHERE w.coin_balance <> (
         300
         + COALESCE((SELECT sum(r.bonus_amount) FROM public.referrals r
                      WHERE r.referrer_id = w.user_id OR r.referred_id = w.user_id), 0)
         + COALESCE((SELECT sum(f.coins_earned) FROM public.focus_sessions f WHERE f.user_id = w.user_id), 0)
         - COALESCE((SELECT sum(f.coins_spent) FROM public.focus_sessions f WHERE f.user_id = w.user_id), 0)
       );

-- 6. The one balance formula.
CREATE OR REPLACE FUNCTION public.ledger_coin_balance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0,
      300
    + COALESCE((SELECT sum(r.bonus_amount) FROM public.referrals r
                 WHERE r.referrer_id = _user_id OR r.referred_id = _user_id), 0)
    + COALESCE((SELECT sum(a.amount) FROM public.coin_adjustments a WHERE a.user_id = _user_id), 0)
    + COALESCE((SELECT sum(f.coins_earned) FROM public.focus_sessions f WHERE f.user_id = _user_id), 0)
    - COALESCE((SELECT sum(f.coins_spent) FROM public.focus_sessions f WHERE f.user_id = _user_id), 0)
  )::integer
$$;

CREATE OR REPLACE FUNCTION public.recompute_wallet(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  v_balance := public.ledger_coin_balance(_user_id);
  UPDATE public.wallets
     SET coin_balance = v_balance,
         coins_reserved = LEAST(coins_reserved, v_balance)
   WHERE user_id = _user_id
     AND (coin_balance IS DISTINCT FROM v_balance OR coins_reserved > v_balance);
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = _user_id)
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    INSERT INTO public.wallets (user_id, coin_balance) VALUES (_user_id, v_balance)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.ledger_coin_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_coin_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_wallet(uuid) TO service_role;

-- Every ledger change recomputes the wallet automatically.
CREATE OR REPLACE FUNCTION public.wallet_from_ledger_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'referrals' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      PERFORM public.recompute_wallet(NEW.referrer_id);
      PERFORM public.recompute_wallet(NEW.referred_id);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
      PERFORM public.recompute_wallet(OLD.referrer_id);
      PERFORM public.recompute_wallet(OLD.referred_id);
    END IF;
  ELSE
    IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM public.recompute_wallet(NEW.user_id); END IF;
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      PERFORM public.recompute_wallet(OLD.user_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_wallet_from_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.wallet_from_ledger_row();
CREATE TRIGGER trg_wallet_from_referrals
  AFTER INSERT OR UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.wallet_from_ledger_row();
CREATE TRIGGER trg_wallet_from_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON public.coin_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.wallet_from_ledger_row();

-- 7. Session claims: server clock for start time; archive on every release.
CREATE OR REPLACE FUNCTION public.active_session_server_clock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mode NOT LIKE 'group:%' THEN
    NEW.started_at := now();
    NEW.last_heartbeat := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_active_session_server_clock
  BEFORE INSERT ON public.active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.active_session_server_clock();

CREATE OR REPLACE FUNCTION public.archive_ended_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.mode NOT LIKE 'group:%' THEN
    INSERT INTO public.session_claims_archive
      (user_id, goal, duration_minutes, value, mode, started_at, status, failure_reason, platform)
    VALUES
      (OLD.user_id, OLD.goal, OLD.duration_minutes, OLD.value, OLD.mode, OLD.started_at,
       OLD.status, OLD.failure_reason, OLD.platform);
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_archive_ended_claim
  BEFORE DELETE ON public.active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.archive_ended_claim();

-- 8. Recording a session outcome: exactly once, from a genuine claim.
DROP FUNCTION IF EXISTS public.record_focus_session_from_active(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.record_focus_session_from_active(
  _user_id uuid,
  _session_id uuid,
  _requested_status text,
  _duration_minutes integer DEFAULT NULL,
  _value integer DEFAULT NULL,
  _mode text DEFAULT NULL,
  _ended_at timestamptz DEFAULT NULL
)
RETURNS TABLE(session_id uuid, coin_balance integer, accepted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hint timestamptz := LEAST(COALESCE(_ended_at, now()), now());
  v_from_active boolean := false;
  v_archive_id uuid;
  v_goal text;
  v_duration integer;
  v_value integer;
  v_mode text;
  v_started timestamptz;
  v_status text;
  v_balance integer;
  v_spent integer := 0;
  v_earned integer := 0;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL
     OR _requested_status NOT IN ('completed', 'failed') THEN
    RETURN QUERY SELECT _session_id, 0, false;
    RETURN;
  END IF;

  -- Serialise every coin/session change for this user (same key as groups).
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  -- Idempotent: the same session id is never counted twice.
  IF EXISTS (SELECT 1 FROM public.focus_sessions f WHERE f.id = _session_id AND f.user_id = _user_id) THEN
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), true;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.focus_sessions f WHERE f.id = _session_id) THEN
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), false;
    RETURN;
  END IF;

  -- The live claim first.
  SELECT a.goal, a.duration_minutes, a.value, a.mode, a.started_at, a.status
    INTO v_goal, v_duration, v_value, v_mode, v_started, v_status
    FROM public.active_sessions a
   WHERE a.user_id = _user_id
     AND a.mode NOT LIKE 'group:%'
     AND (_duration_minutes IS NULL OR a.duration_minutes = _duration_minutes)
     AND (_value IS NULL OR a.value = _value)
     AND (_mode IS NULL OR a.mode = _mode)
     AND a.started_at <= v_hint + interval '10 minutes'
   FOR UPDATE;

  IF FOUND THEN
    v_from_active := true;
  ELSE
    -- A claim released before its outcome arrived (expired sign-in, offline,
    -- app restart): still recordable, but only once.
    SELECT c.id, c.goal, c.duration_minutes, c.value, c.mode, c.started_at, c.status
      INTO v_archive_id, v_goal, v_duration, v_value, v_mode, v_started, v_status
      FROM public.session_claims_archive c
     WHERE c.user_id = _user_id
       AND c.consumed_at IS NULL
       AND c.archived_at > now() - interval '14 days'
       AND (_duration_minutes IS NULL OR c.duration_minutes = _duration_minutes)
       AND (_value IS NULL OR c.value = _value)
       AND (_mode IS NULL OR c.mode = _mode)
       AND c.started_at <= v_hint + interval '10 minutes'
     ORDER BY c.started_at DESC
     LIMIT 1
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), false;
      RETURN;
    END IF;
  END IF;

  -- A completion needs the full window (1 minute tolerance for clock drift)
  -- and a claim that was never marked failed.
  IF _requested_status = 'completed' AND (
       v_status <> 'active'
       OR now() < v_started + make_interval(mins => v_duration) - interval '1 minute'
     ) THEN
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), false;
    RETURN;
  END IF;

  v_balance := public.recompute_wallet(_user_id);
  IF _requested_status = 'completed' THEN
    v_earned := 25 * floor(GREATEST(0, v_duration)::numeric / 60)::integer;
  ELSIF v_value >= 50 THEN
    v_spent := LEAST(v_value, v_balance);
  END IF;

  INSERT INTO public.focus_sessions (
    id, user_id, goal, duration_minutes, value, mode, status,
    coins_spent, coins_earned, created_at, source_key
  ) VALUES (
    _session_id, _user_id, v_goal, v_duration, v_value, v_mode, _requested_status,
    v_spent, v_earned, v_started, 'claim:' || v_started::text
  );

  IF v_from_active THEN
    DELETE FROM public.active_sessions WHERE user_id = _user_id;
    UPDATE public.session_claims_archive
       SET consumed_at = now(), consumed_session_id = _session_id
     WHERE user_id = _user_id AND started_at = v_started AND consumed_at IS NULL;
  ELSE
    UPDATE public.session_claims_archive
       SET consumed_at = now(), consumed_session_id = _session_id
     WHERE id = v_archive_id;
  END IF;

  RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_focus_session_from_active(uuid, uuid, text, integer, integer, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_focus_session_from_active(uuid, uuid, text, integer, integer, text, timestamptz)
  TO service_role;

-- 9. Bring every wallet and leaderboard row in line with the ledger.
SELECT public.recompute_wallet(w.user_id) FROM public.wallets w;
SELECT public.refresh_leaderboard_total(p.id) FROM public.profiles p;
