CREATE OR REPLACE FUNCTION public.join_study_group(_user_id uuid, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := _user_id; g public.study_groups; wallet_row public.wallets; existing public.group_members;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  PERFORM public.release_stale_commitments(uid);
  SELECT * INTO g FROM public.study_groups WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'That invite code does not exist.'; END IF;
  SELECT * INTO existing FROM public.group_members WHERE group_id = g.id AND user_id = uid;
  IF existing.id IS NOT NULL THEN RETURN g.id; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'This group has already started.'; END IF;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status <> 'left') >= 20 THEN RAISE EXCEPTION 'This group is full.'; END IF;
  IF EXISTS (SELECT 1 FROM public.active_sessions WHERE user_id = uid) THEN RAISE EXCEPTION 'Finish your current session before joining a group.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE user_id = uid AND status IN ('committed', 'joined')) THEN RAISE EXCEPTION 'You already have an unfinished group session.'; END IF;
  SELECT * INTO wallet_row FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF wallet_row.user_id IS NULL THEN RAISE EXCEPTION 'Your Cx Coin wallet is not ready yet.'; END IF;
  IF wallet_row.coin_balance - wallet_row.coins_reserved < g.commit_value THEN RAISE EXCEPTION 'You do not have enough available Cx Coins to join.'; END IF;
  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (g.id, uid, public.group_display_name(uid), 'member', 'committed', now(), g.commit_value)
  ON CONFLICT (group_id, user_id) DO NOTHING;
  IF NOT FOUND THEN RETURN g.id; END IF;
  UPDATE public.wallets SET coins_reserved = coins_reserved + g.commit_value WHERE user_id = uid;
  RETURN g.id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO authenticated, service_role;