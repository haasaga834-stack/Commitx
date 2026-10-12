
CREATE OR REPLACE FUNCTION public.settle_unreported_claims(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c record; n integer := 0; sid uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  DELETE FROM public.active_sessions
   WHERE user_id = _user_id AND mode NOT LIKE 'group:%'
     AND now() > started_at + make_interval(mins => duration_minutes + 30);

  FOR c IN
    SELECT * FROM public.session_claims_archive
     WHERE user_id = _user_id AND consumed_at IS NULL
       AND status = 'active'
       AND mode NOT LIKE 'group:%'
       AND archived_at > now() - interval '14 days'
       AND archived_at >= started_at + make_interval(mins => duration_minutes) - interval '1 minute'
       AND archived_at < now() - interval '20 minutes'
     ORDER BY started_at
     FOR UPDATE
  LOOP
    IF EXISTS (SELECT 1 FROM public.focus_sessions f
                WHERE f.user_id = _user_id AND f.source_key = 'claim:' || c.started_at::text) THEN
      UPDATE public.session_claims_archive SET consumed_at = now() WHERE id = c.id;
      CONTINUE;
    END IF;
    sid := gen_random_uuid();
    INSERT INTO public.focus_sessions (id, user_id, goal, duration_minutes, value, mode, status,
                                       coins_spent, coins_earned, created_at, source_key)
    VALUES (sid, _user_id, c.goal, c.duration_minutes, c.value, c.mode, 'completed',
            0, 25 * floor(GREATEST(0, c.duration_minutes)::numeric / 60)::integer,
            c.started_at, 'claim:' || c.started_at::text);
    UPDATE public.session_claims_archive SET consumed_at = now(), consumed_session_id = sid WHERE id = c.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.settle_unreported_claims(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_unreported_claims(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_my_unreported_sessions()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.settle_unreported_claims(auth.uid()) $$;
REVOKE ALL ON FUNCTION public.settle_my_unreported_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_my_unreported_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_all_unreported_claims()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE u uuid; total integer := 0;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id FROM public.session_claims_archive
     WHERE consumed_at IS NULL AND status = 'active' AND archived_at > now() - interval '14 days'
    UNION
    SELECT user_id FROM public.active_sessions
     WHERE mode NOT LIKE 'group:%' AND now() > started_at + make_interval(mins => duration_minutes + 30)
  LOOP
    total := total + public.settle_unreported_claims(u);
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.settle_all_unreported_claims() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_all_unreported_claims() TO service_role;

CREATE OR REPLACE FUNCTION public.record_focus_session_from_active(_user_id uuid, _session_id uuid, _requested_status text, _duration_minutes integer DEFAULT NULL::integer, _value integer DEFAULT NULL::integer, _mode text DEFAULT NULL::text, _ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(session_id uuid, coin_balance integer, accepted boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_hint timestamptz := LEAST(COALESCE(_ended_at, now()), now());
  v_src text; v_archive_id uuid;
  v_goal text; v_duration integer; v_value integer; v_mode text; v_started timestamptz; v_status text;
  v_balance integer; v_spent integer := 0; v_earned integer := 0;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL OR _requested_status NOT IN ('completed', 'failed') THEN
    RETURN QUERY SELECT _session_id, 0, false; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.focus_sessions f WHERE f.id = _session_id AND f.user_id = _user_id) THEN
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), true; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.focus_sessions f WHERE f.id = _session_id) THEN
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), false; RETURN;
  END IF;

  SELECT k.src, k.aid, k.goal, k.duration_minutes, k.value, k.mode, k.started_at, k.status
    INTO v_src, v_archive_id, v_goal, v_duration, v_value, v_mode, v_started, v_status
  FROM (
    SELECT 'live'::text src, NULL::uuid aid, a.goal, a.duration_minutes, a.value, a.mode, a.started_at, a.status
      FROM public.active_sessions a WHERE a.user_id = _user_id AND a.mode NOT LIKE 'group:%'
    UNION ALL
    SELECT 'archive', c.id, c.goal, c.duration_minutes, c.value, c.mode, c.started_at, c.status
      FROM public.session_claims_archive c
     WHERE c.user_id = _user_id AND c.consumed_at IS NULL AND c.archived_at > now() - interval '14 days'
       AND c.mode NOT LIKE 'group:%'
  ) k
  WHERE (_duration_minutes IS NULL OR k.duration_minutes = _duration_minutes)
    AND (_value IS NULL OR k.value = _value)
    AND (_mode IS NULL OR k.mode = _mode)
    AND k.started_at <= v_hint + interval '10 minutes'
    AND (_requested_status = 'failed' OR (
          k.status = 'active'
          AND now() >= k.started_at + make_interval(mins => k.duration_minutes) - interval '1 minute'))
  ORDER BY
    CASE WHEN _requested_status = 'completed'
         THEN abs(extract(epoch FROM (k.started_at + make_interval(mins => k.duration_minutes) - v_hint)))
         ELSE -extract(epoch FROM k.started_at) END
  LIMIT 1;

  IF v_src IS NULL THEN
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), false; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.focus_sessions f WHERE f.user_id = _user_id AND f.source_key = 'claim:' || v_started::text) THEN
    UPDATE public.session_claims_archive SET consumed_at = COALESCE(consumed_at, now())
     WHERE user_id = _user_id AND started_at = v_started;
    RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), false; RETURN;
  END IF;

  v_balance := public.recompute_wallet(_user_id);
  IF _requested_status = 'completed' THEN
    v_earned := 25 * floor(GREATEST(0, v_duration)::numeric / 60)::integer;
  ELSIF v_value >= 50 THEN
    v_spent := LEAST(v_value, v_balance);
  END IF;

  INSERT INTO public.focus_sessions (id, user_id, goal, duration_minutes, value, mode, status,
    coins_spent, coins_earned, created_at, source_key)
  VALUES (_session_id, _user_id, v_goal, v_duration, v_value, v_mode, _requested_status,
    v_spent, v_earned, v_started, 'claim:' || v_started::text);

  IF v_src = 'live' THEN
    DELETE FROM public.active_sessions WHERE user_id = _user_id AND started_at = v_started;
    UPDATE public.session_claims_archive SET consumed_at = now(), consumed_session_id = _session_id
     WHERE user_id = _user_id AND started_at = v_started AND consumed_at IS NULL;
  ELSE
    UPDATE public.session_claims_archive SET consumed_at = now(), consumed_session_id = _session_id
     WHERE id = v_archive_id;
  END IF;

  RETURN QUERY SELECT _session_id, public.recompute_wallet(_user_id), true;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_user_claim_unique
  ON public.focus_sessions (user_id, source_key) WHERE source_key LIKE 'claim:%';

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('commitx-settle-unreported-claims', '0 * * * *',
  $$SELECT public.settle_all_unreported_claims()$$);
