ALTER TABLE public.wallets RENAME COLUMN demo_balance TO coin_balance;
ALTER TABLE public.wallets RENAME COLUMN reserved_demo TO coins_reserved;
ALTER TABLE public.wallets DROP COLUMN real_balance;

ALTER TABLE public.focus_sessions RENAME COLUMN demo_used TO coins_spent;
ALTER TABLE public.focus_sessions DROP COLUMN real_used;
ALTER TABLE public.focus_sessions ADD COLUMN coins_earned integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.enforce_wallet_bounds()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.coin_balance, 0) < 0 OR COALESCE(NEW.coin_balance, 0) > 1000000 THEN
    RAISE EXCEPTION 'Invalid coin balance';
  END IF;
  IF COALESCE(NEW.coins_reserved, 0) < 0 OR COALESCE(NEW.coins_reserved, 0) > COALESCE(NEW.coin_balance, 0) THEN
    RAISE EXCEPTION 'Invalid reserved coin amount';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_session_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Sessions require an owner';
  END IF;
  IF NEW.duration_minutes IS NULL OR NEW.duration_minutes < 1 OR NEW.duration_minutes > 720 THEN
    RAISE EXCEPTION 'Invalid session duration';
  END IF;
  IF NEW.status NOT IN ('completed', 'failed', 'active', 'ended') THEN
    RAISE EXCEPTION 'Invalid session status';
  END IF;
  IF COALESCE(NEW.coins_spent, 0) < 0 OR COALESCE(NEW.coins_spent, 0) > 500 THEN
    RAISE EXCEPTION 'Invalid commitment amount for session';
  END IF;
  IF COALESCE(NEW.coins_earned, 0) < 0 OR COALESCE(NEW.coins_earned, 0) > 1000 THEN
    RAISE EXCEPTION 'Invalid coin reward for session';
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.focus_sessions SET coins_earned = 25 * floor(duration_minutes / 60.0)::int WHERE status = 'completed';

CREATE OR REPLACE FUNCTION public.create_study_group(_user_id uuid, _goal text, _duration integer, _value integer, _mode text, _theme text DEFAULT 'leaves'::text)
 RETURNS TABLE(id uuid, code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := _user_id;
  wallet_row public.wallets;
  new_group public.study_groups;
  invite_code text;
  theme_value text := coalesce(_theme, 'leaves');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  PERFORM public.release_stale_commitments(uid);
  IF char_length(trim(_goal)) < 1 OR char_length(trim(_goal)) > 40 THEN RAISE EXCEPTION 'Enter a goal between 1 and 40 characters.'; END IF;
  IF _duration < 10 OR _duration > 360 THEN RAISE EXCEPTION 'Choose a duration from 10 to 360 minutes.'; END IF;
  IF _value < 50 OR _value > 500 THEN RAISE EXCEPTION 'Choose a commitment from 50 to 500 Cx Coins.'; END IF;
  IF _mode NOT IN ('standard', 'verified') THEN RAISE EXCEPTION 'Choose a valid session type.'; END IF;
  IF theme_value NOT IN ('leaves', 'fireflies', 'tree', 'moon', 'lotus') THEN theme_value := 'leaves'; END IF;
  IF EXISTS (SELECT 1 FROM public.active_sessions WHERE user_id = uid) THEN RAISE EXCEPTION 'Finish your current session before creating a group.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE user_id = uid AND status IN ('committed', 'joined')) THEN RAISE EXCEPTION 'You already have an unfinished group session.'; END IF;
  SELECT * INTO wallet_row FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF wallet_row.user_id IS NULL THEN RAISE EXCEPTION 'Your Cx Coin wallet is not ready yet.'; END IF;
  IF wallet_row.coin_balance - wallet_row.coins_reserved < _value THEN RAISE EXCEPTION 'Not enough available Cx Coins for this commitment.'; END IF;
  LOOP
    invite_code := '';
    FOR i IN 1..6 LOOP invite_code := invite_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.study_groups WHERE study_groups.code = invite_code);
  END LOOP;
  INSERT INTO public.study_groups (creator_id, code, goal, duration_minutes, commit_value, mode, status, theme)
  VALUES (uid, invite_code, trim(_goal), _duration, _value, _mode, 'lobby', theme_value) RETURNING * INTO new_group;
  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (new_group.id, uid, public.group_display_name(uid), 'creator', 'committed', now(), _value);
  UPDATE public.wallets SET coins_reserved = coins_reserved + _value WHERE user_id = uid;
  RETURN QUERY SELECT new_group.id, new_group.code;
END;
$function$;

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
  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status <> 'left') >= 5 THEN RAISE EXCEPTION 'This group is full.'; END IF;
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

CREATE OR REPLACE FUNCTION public.cancel_study_group(_user_id uuid, _group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := _user_id; g public.study_groups; gm record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN
    PERFORM public.release_stale_commitments(uid);
    RETURN true;
  END IF;
  IF g.creator_id <> uid THEN RAISE EXCEPTION 'Only the organizer can cancel this group.'; END IF;
  IF g.status = 'active' AND g.ends_at IS NOT NULL AND now() < g.ends_at THEN
    RAISE EXCEPTION 'A running group cannot be cancelled.';
  END IF;
  FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND settled_at IS NULL FOR UPDATE LOOP
    UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - gm.held_amount) WHERE user_id = gm.user_id;
    DELETE FROM public.active_sessions WHERE user_id = gm.user_id;
  END LOOP;
  DELETE FROM public.study_groups WHERE id = g.id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_study_lobby(_user_id uuid, _group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g public.study_groups; m public.group_members;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN
    PERFORM public.release_stale_commitments(_user_id);
    RETURN true;
  END IF;
  SELECT * INTO m FROM public.group_members WHERE group_id = g.id AND user_id = _user_id FOR UPDATE;
  IF m.id IS NULL THEN RETURN true; END IF;
  IF g.status = 'active' AND g.ends_at IS NOT NULL AND now() < g.ends_at THEN
    RAISE EXCEPTION 'This group has already started.';
  END IF;
  IF m.settled_at IS NULL THEN
    UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - m.held_amount) WHERE user_id = _user_id;
  END IF;
  DELETE FROM public.active_sessions WHERE user_id = _user_id;
  DELETE FROM public.group_members WHERE id = m.id;
  IF g.creator_id = _user_id THEN
    FOR m IN SELECT * FROM public.group_members WHERE group_id = g.id AND settled_at IS NULL FOR UPDATE LOOP
      UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - m.held_amount) WHERE user_id = m.user_id;
      DELETE FROM public.active_sessions WHERE user_id = m.user_id;
    END LOOP;
    DELETE FROM public.study_groups WHERE id = g.id;
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_stale_commitments(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE gm record; g record;
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
       WHERE sg.status = 'active'
         AND sg.ends_at IS NOT NULL
         AND now() < sg.ends_at
     );

  FOR g IN
    SELECT sg.* FROM public.study_groups sg
    JOIN public.group_members m ON m.group_id = sg.id AND m.user_id = _user_id
    WHERE sg.status = 'lobby'
      AND sg.started_at IS NULL
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

  FOR gm IN
    SELECT m.*, g2.status AS gstatus, g2.ends_at
    FROM public.group_members m
    JOIN public.study_groups g2 ON g2.id = m.group_id
    WHERE m.user_id = _user_id
      AND m.status IN ('committed', 'joined')
      AND m.settled_at IS NULL
      AND (g2.status = 'ended' OR (g2.ends_at IS NOT NULL AND now() > g2.ends_at))
    FOR UPDATE OF m
  LOOP
    UPDATE public.wallets
      SET coins_reserved = greatest(0, coins_reserved - gm.held_amount)
      WHERE user_id = _user_id;
    UPDATE public.group_members
      SET status = 'completed', settled_at = now()
      WHERE id = gm.id;
    DELETE FROM public.active_sessions WHERE user_id = _user_id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_expired_study_group(_user_id uuid, _group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    VALUES (gm.user_id, g.goal, g.duration_minutes, g.commit_value, g.mode, 'completed', g.commit_value, reward);
  END LOOP;
  DELETE FROM public.active_sessions WHERE user_id IN (SELECT user_id FROM public.group_members WHERE group_id = g.id);
  UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_study_group_member(_user_id uuid, _group_id uuid, _status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  VALUES (uid, g.goal, g.duration_minutes, g.commit_value, g.mode, CASE WHEN final_status = 'completed' THEN 'completed' ELSE 'failed' END, g.commit_value, reward);
  IF _status = 'completed' AND NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined')) THEN UPDATE public.study_groups SET status = 'ended' WHERE id = g.id; END IF;
  RETURN final_status;
END;
$function$;