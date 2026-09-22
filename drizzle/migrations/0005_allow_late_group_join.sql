CREATE OR REPLACE FUNCTION public.join_study_group(_user_id uuid, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := _user_id; g public.study_groups; wallet_row public.wallets; existing public.group_members; late boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  PERFORM public.release_stale_commitments(uid);
  SELECT * INTO g FROM public.study_groups WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'That invite code does not exist.'; END IF;
  SELECT * INTO existing FROM public.group_members WHERE group_id = g.id AND user_id = uid;
  IF existing.id IS NOT NULL THEN RETURN g.id; END IF;

  -- Late joining: allowed while the one shared window is still running.
  late := (g.status = 'active');
  IF late AND (g.ends_at IS NULL OR now() >= g.ends_at) THEN
    RAISE EXCEPTION 'This group session has already finished.';
  END IF;
  IF g.status NOT IN ('lobby', 'active') THEN
    RAISE EXCEPTION 'This group session has already finished.';
  END IF;

  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status <> 'left') >= 20 THEN RAISE EXCEPTION 'This group is full.'; END IF;
  IF EXISTS (SELECT 1 FROM public.active_sessions WHERE user_id = uid) THEN RAISE EXCEPTION 'Finish your current session before joining a group.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE user_id = uid AND status IN ('committed', 'joined')) THEN RAISE EXCEPTION 'You already have an unfinished group session.'; END IF;
  SELECT * INTO wallet_row FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF wallet_row.user_id IS NULL THEN RAISE EXCEPTION 'Your Cx Coin wallet is not ready yet.'; END IF;
  IF wallet_row.coin_balance - wallet_row.coins_reserved < g.commit_value THEN RAISE EXCEPTION 'You do not have enough available Cx Coins to join.'; END IF;

  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, joined_at, held_amount)
  VALUES (g.id, uid, public.group_display_name(uid), 'member',
          CASE WHEN late THEN 'joined' ELSE 'committed' END,
          now(), CASE WHEN late THEN now() ELSE NULL END, g.commit_value)
  ON CONFLICT (group_id, user_id) DO NOTHING;
  IF NOT FOUND THEN RETURN g.id; END IF;
  UPDATE public.wallets SET coins_reserved = coins_reserved + g.commit_value WHERE user_id = uid;

  -- A late joiner shares the group's authoritative start/end stamps, so their
  -- timer shows the time that is actually left, never a fresh countdown.
  IF late THEN
    INSERT INTO public.active_sessions (user_id, goal, duration_minutes, value, mode, started_at)
    VALUES (uid, g.goal, g.duration_minutes, g.commit_value, 'group:' || g.mode, g.started_at)
    ON CONFLICT (user_id) DO UPDATE
      SET goal = EXCLUDED.goal,
          duration_minutes = EXCLUDED.duration_minutes,
          value = EXCLUDED.value,
          mode = EXCLUDED.mode,
          started_at = EXCLUDED.started_at;
  END IF;

  RETURN g.id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO authenticated, service_role;