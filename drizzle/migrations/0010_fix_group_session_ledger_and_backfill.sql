
CREATE OR REPLACE FUNCTION public.settle_expired_study_group(_user_id uuid, _group_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g public.study_groups; gm record; reward integer;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL OR g.status <> 'active' OR g.ends_at IS NULL OR now() < g.ends_at THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g.id AND user_id = _user_id) THEN RAISE EXCEPTION 'Not allowed.'; END IF;
  reward := 25 * floor(g.duration_minutes / 60.0)::int;
  FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined') AND settled_at IS NULL FOR UPDATE LOOP
    UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - gm.held_amount), coin_balance = coin_balance + reward WHERE user_id = gm.user_id;
    UPDATE public.group_members SET status = 'completed', settled_at = now() WHERE id = gm.id;
    INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned)
    VALUES (gm.user_id, g.goal, g.duration_minutes, g.commit_value, g.mode, 'completed', 0, reward);
  END LOOP;
  DELETE FROM public.active_sessions WHERE user_id IN (SELECT user_id FROM public.group_members WHERE group_id = g.id);
  UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_study_group_member(_user_id uuid, _group_id uuid, _status text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := _user_id; g public.study_groups; member public.group_members; final_status text; reward integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF _status NOT IN ('completed', 'failed', 'left') THEN RAISE EXCEPTION 'Invalid outcome.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  SELECT * INTO member FROM public.group_members WHERE group_id = g.id AND user_id = uid FOR UPDATE;
  IF member.id IS NULL THEN RAISE EXCEPTION 'You are not a member of this group.'; END IF;
  IF member.settled_at IS NOT NULL THEN RETURN member.status; END IF;
  reward := 0;
  IF _status = 'completed' THEN
    IF g.ends_at IS NULL OR now() < g.ends_at THEN RAISE EXCEPTION 'The shared timer has not finished yet.'; END IF;
    reward := 25 * floor(g.duration_minutes / 60.0)::int;
    UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - member.held_amount), coin_balance = coin_balance + reward WHERE user_id = uid;
    UPDATE public.group_members SET status = 'completed', settled_at = now() WHERE id = member.id;
    DELETE FROM public.active_sessions WHERE user_id = uid;
    final_status := 'completed';
  ELSE
    final_status := CASE WHEN _status = 'left' THEN 'left' ELSE 'failed' END;
    UPDATE public.wallets SET coin_balance = greatest(0, coin_balance - member.held_amount), coins_reserved = greatest(0, coins_reserved - member.held_amount) WHERE user_id = uid;
    UPDATE public.group_members SET status = final_status, left_at = now(), settled_at = now() WHERE id = member.id;
    DELETE FROM public.active_sessions WHERE user_id = uid;
  END IF;
  INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned)
  VALUES (uid, g.goal, g.duration_minutes, g.commit_value, g.mode,
          CASE WHEN final_status = 'completed' THEN 'completed' ELSE 'failed' END,
          CASE WHEN final_status = 'completed' THEN 0 ELSE g.commit_value END, reward);
  IF _status = 'completed' AND NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined')) THEN UPDATE public.study_groups SET status = 'ended' WHERE id = g.id; END IF;
  RETURN final_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_stale_commitments(_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE gm record; g record; reward integer;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.active_sessions
  WHERE user_id = _user_id
    AND now() > started_at + make_interval(mins => duration_minutes + 30);

  DELETE FROM public.active_sessions a
   WHERE a.user_id = _user_id
     AND a.mode LIKE 'group:%'
     AND NOT EXISTS (
       SELECT 1 FROM public.study_groups sg
       JOIN public.group_members m ON m.group_id = sg.id AND m.user_id = _user_id
       WHERE sg.status = 'active' AND sg.ends_at IS NOT NULL AND now() < sg.ends_at
     );

  FOR g IN
    SELECT sg.* FROM public.study_groups sg
    JOIN public.group_members m ON m.group_id = sg.id AND m.user_id = _user_id
    WHERE sg.status = 'lobby' AND sg.started_at IS NULL
      AND now() > sg.updated_at + interval '3 hours'
      AND now() > sg.created_at + interval '3 hours'
    FOR UPDATE OF sg
  LOOP
    FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND settled_at IS NULL FOR UPDATE LOOP
      UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - gm.held_amount) WHERE user_id = gm.user_id;
      UPDATE public.group_members SET status = 'expired', settled_at = now() WHERE id = gm.id;
      DELETE FROM public.active_sessions WHERE user_id = gm.user_id;
    END LOOP;
    UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  END LOOP;

  -- Finished shared windows: a member who was in the running session is
  -- credited exactly like a normal completion (recorded once, via settled_at).
  FOR gm IN
    SELECT m.*, g2.status AS gstatus, g2.ends_at, g2.goal AS ggoal, g2.duration_minutes AS gdur,
           g2.commit_value AS gvalue, g2.mode AS gmode
    FROM public.group_members m
    JOIN public.study_groups g2 ON g2.id = m.group_id
    WHERE m.user_id = _user_id
      AND m.status IN ('committed', 'joined')
      AND m.settled_at IS NULL
      AND (g2.status = 'ended' OR (g2.ends_at IS NOT NULL AND now() > g2.ends_at))
    FOR UPDATE OF m
  LOOP
    IF gm.status = 'joined' AND gm.ends_at IS NOT NULL AND now() >= gm.ends_at THEN
      reward := 25 * floor(gm.gdur / 60.0)::int;
      UPDATE public.wallets
        SET coins_reserved = greatest(0, coins_reserved - gm.held_amount),
            coin_balance = coin_balance + reward
        WHERE user_id = _user_id;
      INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned)
      VALUES (_user_id, gm.ggoal, gm.gdur, gm.gvalue, gm.gmode, 'completed', 0, reward);
    ELSE
      UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - gm.held_amount) WHERE user_id = _user_id;
    END IF;
    UPDATE public.group_members SET status = 'completed', settled_at = now() WHERE id = gm.id;
    DELETE FROM public.active_sessions WHERE user_id = _user_id;
  END LOOP;
END;
$function$;

-- Backfill: finished group sessions that were settled without being recorded.
INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned, created_at)
SELECT m.user_id, g.goal, g.duration_minutes, g.commit_value, g.mode, 'completed', 0,
       25 * floor(g.duration_minutes / 60.0)::int, m.settled_at
FROM public.group_members m
JOIN public.study_groups g ON g.id = m.group_id
WHERE m.status = 'completed' AND g.ends_at IS NOT NULL AND m.settled_at >= g.ends_at
  AND NOT EXISTS (
    SELECT 1 FROM public.focus_sessions s
    WHERE s.user_id = m.user_id AND s.goal = g.goal AND s.duration_minutes = g.duration_minutes
      AND s.created_at BETWEEN m.settled_at - interval '2 minutes' AND m.settled_at + interval '2 minutes');

-- Completed sessions return the commitment; they must never count as spent.
UPDATE public.focus_sessions SET coins_spent = 0 WHERE status = 'completed' AND coins_spent > 0;

-- Wallets: credit only what the corrected ledger says was missed; never reduce.
WITH l AS (
  SELECT user_id, sum(coins_earned) e, sum(coins_spent) sp FROM public.focus_sessions GROUP BY 1
), r AS (
  SELECT u, sum(b) b FROM (
    SELECT referrer_id u, bonus_amount b FROM public.referrals
    UNION ALL SELECT referred_id, bonus_amount FROM public.referrals) x GROUP BY 1
)
UPDATE public.wallets w
   SET coin_balance = LEAST(1000000, greatest(w.coin_balance, 300 + coalesce(r.b, 0) + l.e - l.sp))
  FROM l LEFT JOIN r ON r.u = l.user_id
 WHERE l.user_id = w.user_id
   AND 300 + coalesce(r.b, 0) + l.e - l.sp > w.coin_balance;

-- Authoritative per-user totals for the profile (all records, no row limit).
CREATE OR REPLACE FUNCTION public.my_focus_totals()
 RETURNS TABLE(total_minutes bigint, completed bigint, failed bigint, coins_earned bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(duration_minutes) FILTER (WHERE status = 'completed'), 0)::bigint,
         COUNT(*) FILTER (WHERE status = 'completed')::bigint,
         COUNT(*) FILTER (WHERE status = 'failed')::bigint,
         COALESCE(SUM(coins_earned), 0)::bigint
    FROM public.focus_sessions WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_focus_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_focus_totals() TO authenticated;
