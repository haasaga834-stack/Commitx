ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS reserved_demo integer NOT NULL DEFAULT 0;

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS held_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_held_amount_bounds
  CHECK (held_amount >= 0 AND held_amount <= 500);

DROP POLICY IF EXISTS group_members_delete_self ON public.group_members;
REVOKE DELETE ON public.group_members FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_wallet_bounds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.demo_balance, 0) < 0 OR COALESCE(NEW.demo_balance, 0) > 1000 THEN
    RAISE EXCEPTION 'Invalid demo balance';
  END IF;
  IF COALESCE(NEW.reserved_demo, 0) < 0 OR COALESCE(NEW.reserved_demo, 0) > COALESCE(NEW.demo_balance, 0) THEN
    RAISE EXCEPTION 'Invalid reserved demo balance';
  END IF;
  IF COALESCE(NEW.real_balance, 0) <> 0 THEN
    RAISE EXCEPTION 'Real money balances are not available';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.group_display_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT display_name FROM public.profiles WHERE id = _user_id), 'Friend');
$$;

REVOKE ALL ON FUNCTION public.group_display_name(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_study_group(
  _goal text,
  _duration integer,
  _value integer,
  _mode text
)
RETURNS TABLE(id uuid, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wallet_row public.wallets;
  new_group public.study_groups;
  invite_code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  IF char_length(trim(_goal)) < 1 OR char_length(trim(_goal)) > 40 THEN RAISE EXCEPTION 'Enter a goal between 1 and 40 characters.'; END IF;
  IF _duration < 10 OR _duration > 360 THEN RAISE EXCEPTION 'Choose a duration from 10 to 360 minutes.'; END IF;
  IF _value < 50 OR _value > 500 THEN RAISE EXCEPTION 'Choose a commitment from ₹50 to ₹500.'; END IF;
  IF _mode NOT IN ('standard', 'verified') THEN RAISE EXCEPTION 'Choose a valid session type.'; END IF;
  IF EXISTS (SELECT 1 FROM public.active_sessions WHERE user_id = uid) THEN RAISE EXCEPTION 'Finish your current session before creating a group.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE user_id = uid AND status IN ('committed', 'joined')) THEN RAISE EXCEPTION 'You already have an unfinished group session.'; END IF;

  SELECT * INTO wallet_row FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF wallet_row.user_id IS NULL THEN RAISE EXCEPTION 'Your demo wallet is not ready yet.'; END IF;
  IF wallet_row.demo_balance - wallet_row.reserved_demo < _value THEN RAISE EXCEPTION 'Not enough available demo money for this commitment.'; END IF;

  LOOP
    invite_code := '';
    FOR i IN 1..6 LOOP
      invite_code := invite_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.study_groups WHERE study_groups.code = invite_code);
  END LOOP;

  INSERT INTO public.study_groups (creator_id, code, goal, duration_minutes, commit_value, mode, status)
  VALUES (uid, invite_code, trim(_goal), _duration, _value, _mode, 'lobby')
  RETURNING * INTO new_group;

  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (new_group.id, uid, public.group_display_name(uid), 'creator', 'committed', now(), _value);

  UPDATE public.wallets SET reserved_demo = reserved_demo + _value WHERE user_id = uid;
  RETURN QUERY SELECT new_group.id, new_group.code;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_study_group(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g public.study_groups;
  wallet_row public.wallets;
  existing public.group_members;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  SELECT * INTO g FROM public.study_groups WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'That invite code does not exist.'; END IF;

  SELECT * INTO existing FROM public.group_members WHERE group_id = g.id AND user_id = uid;
  IF existing.id IS NOT NULL THEN RETURN g.id; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'This group has already started.'; END IF;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status <> 'left') >= 5 THEN RAISE EXCEPTION 'This group is full.'; END IF;
  IF EXISTS (SELECT 1 FROM public.active_sessions WHERE user_id = uid) THEN RAISE EXCEPTION 'Finish your current session before joining a group.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE user_id = uid AND status IN ('committed', 'joined')) THEN RAISE EXCEPTION 'You already have an unfinished group session.'; END IF;

  SELECT * INTO wallet_row FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF wallet_row.user_id IS NULL THEN RAISE EXCEPTION 'Your demo wallet is not ready yet.'; END IF;
  IF wallet_row.demo_balance - wallet_row.reserved_demo < g.commit_value THEN RAISE EXCEPTION 'You do not have enough available demo money to join.'; END IF;

  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (g.id, uid, public.group_display_name(uid), 'member', 'committed', now(), g.commit_value);
  UPDATE public.wallets SET reserved_demo = reserved_demo + g.commit_value WHERE user_id = uid;
  RETURN g.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_study_group(_group_id uuid)
RETURNS TABLE(started_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g public.study_groups;
  started timestamptz;
  ending timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  IF g.creator_id <> uid THEN RAISE EXCEPTION 'Only the organizer can start the session.'; END IF;
  IF g.status = 'active' AND g.started_at IS NOT NULL AND g.ends_at IS NOT NULL THEN
    RETURN QUERY SELECT g.started_at, g.ends_at;
    RETURN;
  END IF;
  IF g.status = 'ended' THEN RAISE EXCEPTION 'This group session has already finished.'; END IF;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status = 'committed') < 2 THEN
    RAISE EXCEPTION 'At least one other committed member must be present.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.active_sessions a ON a.user_id = gm.user_id
    WHERE gm.group_id = g.id AND gm.status = 'committed'
  ) THEN RAISE EXCEPTION 'A participant already has another session running.'; END IF;

  started := now();
  ending := started + make_interval(mins => g.duration_minutes);

  INSERT INTO public.active_sessions (user_id, goal, duration_minutes, value, mode, started_at)
  SELECT user_id, g.goal, g.duration_minutes, g.commit_value, 'group:' || g.mode, started
  FROM public.group_members WHERE group_id = g.id AND status = 'committed';

  UPDATE public.group_members SET status = 'joined', joined_at = started
  WHERE group_id = g.id AND status = 'committed';
  UPDATE public.study_groups SET status = 'active', started_at = started, ends_at = ending WHERE id = g.id;
  RETURN QUERY SELECT started, ending;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_study_group_member(_group_id uuid, _status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g public.study_groups;
  member public.group_members;
  final_status text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF _status NOT IN ('completed', 'failed', 'left') THEN RAISE EXCEPTION 'Invalid outcome.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  SELECT * INTO member FROM public.group_members WHERE group_id = g.id AND user_id = uid FOR UPDATE;
  IF member.id IS NULL THEN RAISE EXCEPTION 'You are not a member of this group.'; END IF;
  IF member.settled_at IS NOT NULL THEN RETURN member.status; END IF;

  IF _status = 'completed' THEN
    IF g.ends_at IS NULL OR now() < g.ends_at THEN
      RAISE EXCEPTION 'The shared timer has not finished yet.';
    END IF;
    UPDATE public.wallets
      SET reserved_demo = greatest(0, reserved_demo - member.held_amount)
      WHERE user_id = uid;
    UPDATE public.group_members SET status = 'completed', settled_at = now()
      WHERE id = member.id;
    DELETE FROM public.active_sessions WHERE user_id = uid;
    final_status := 'completed';
  ELSE
    final_status := CASE WHEN _status = 'left' THEN 'left' ELSE 'failed' END;
    UPDATE public.wallets
      SET demo_balance = demo_balance - member.held_amount,
          reserved_demo = reserved_demo - member.held_amount
      WHERE user_id = uid;
    UPDATE public.group_members
      SET status = final_status, left_at = now(), settled_at = now()
      WHERE id = member.id;
    DELETE FROM public.active_sessions WHERE user_id = uid;
  END IF;

  INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, demo_used, real_used)
  VALUES (uid, g.goal, g.duration_minutes, g.commit_value, g.mode,
          CASE WHEN final_status = 'completed' THEN 'completed' ELSE 'failed' END,
          g.commit_value, 0);
  IF _status = 'completed' AND NOT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined')
  ) THEN
    UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  END IF;
  RETURN final_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_expired_study_group(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.study_groups;
  gm record;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL OR g.status <> 'active' OR g.ends_at IS NULL OR now() < g.ends_at THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g.id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed.'; END IF;

  FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined') AND settled_at IS NULL FOR UPDATE LOOP
    UPDATE public.wallets SET reserved_demo = greatest(0, reserved_demo - gm.held_amount) WHERE user_id = gm.user_id;
    UPDATE public.group_members SET status = 'completed', settled_at = now() WHERE id = gm.id;
    INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, demo_used, real_used)
    VALUES (gm.user_id, g.goal, g.duration_minutes, g.commit_value, g.mode, 'completed', g.commit_value, 0);
  END LOOP;
  DELETE FROM public.active_sessions WHERE user_id IN (SELECT user_id FROM public.group_members WHERE group_id = g.id);
  UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_study_group(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g public.study_groups;
  gm record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RETURN true; END IF;
  IF g.creator_id <> uid THEN RAISE EXCEPTION 'Only the organizer can cancel this group.'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'A running group cannot be cancelled.'; END IF;
  FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND settled_at IS NULL FOR UPDATE LOOP
    UPDATE public.wallets SET reserved_demo = greatest(0, reserved_demo - gm.held_amount) WHERE user_id = gm.user_id;
  END LOOP;
  DELETE FROM public.study_groups WHERE id = g.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_study_group(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_study_group(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_study_group(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_study_group_member(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_expired_study_group(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_study_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_study_group(text, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_study_group(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_study_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_study_group_member(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_expired_study_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_study_group(uuid) TO authenticated, service_role;