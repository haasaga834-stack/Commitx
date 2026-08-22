-- 1. No duplicate participants, ever.
DELETE FROM public.group_members gm
USING public.group_members keep
WHERE gm.group_id = keep.group_id
  AND gm.user_id = keep.user_id
  AND gm.ctid > keep.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_user_uidx
  ON public.group_members (group_id, user_id);

-- 2. Members of the same group can see each other (host member list + realtime).
CREATE OR REPLACE FUNCTION public.is_group_participant(_user_id uuid, _group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_group_participant(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS group_members_select_same_group ON public.group_members;
CREATE POLICY group_members_select_same_group ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_group_participant(auth.uid(), group_id));

-- 3. Stale locks must never block a new session.
CREATE OR REPLACE FUNCTION public.release_stale_commitments(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gm record;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  -- Solo/group session rows whose window has elapsed (plus 30 min slack for breaks).
  DELETE FROM public.active_sessions
  WHERE user_id = _user_id
    AND now() > started_at + make_interval(mins => duration_minutes + 30);

  -- Memberships in groups that ended, were cancelled, or whose window elapsed.
  FOR gm IN
    SELECT m.*, g.status AS gstatus, g.ends_at
    FROM public.group_members m
    JOIN public.study_groups g ON g.id = m.group_id
    WHERE m.user_id = _user_id
      AND m.status IN ('committed', 'joined')
      AND m.settled_at IS NULL
      AND (g.status = 'ended' OR (g.ends_at IS NOT NULL AND now() > g.ends_at))
    FOR UPDATE OF m
  LOOP
    UPDATE public.wallets
      SET reserved_demo = greatest(0, reserved_demo - gm.held_amount)
      WHERE user_id = _user_id;
    UPDATE public.group_members
      SET status = 'completed', settled_at = now()
      WHERE id = gm.id;
    DELETE FROM public.active_sessions WHERE user_id = _user_id;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.release_stale_commitments(uuid) TO service_role;

-- 4. Call the cleanup before every blocking check.
CREATE OR REPLACE FUNCTION public.create_study_group(_user_id uuid, _goal text, _duration integer, _value integer, _mode text)
 RETURNS TABLE(id uuid, code text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := _user_id;
  wallet_row public.wallets;
  new_group public.study_groups;
  invite_code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  PERFORM public.release_stale_commitments(uid);
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
    FOR i IN 1..6 LOOP invite_code := invite_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.study_groups WHERE study_groups.code = invite_code);
  END LOOP;
  INSERT INTO public.study_groups (creator_id, code, goal, duration_minutes, commit_value, mode, status)
  VALUES (uid, invite_code, trim(_goal), _duration, _value, _mode, 'lobby') RETURNING * INTO new_group;
  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (new_group.id, uid, public.group_display_name(uid), 'creator', 'committed', now(), _value);
  UPDATE public.wallets SET reserved_demo = reserved_demo + _value WHERE user_id = uid;
  RETURN QUERY SELECT new_group.id, new_group.code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_study_group(_user_id uuid, _code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  IF wallet_row.user_id IS NULL THEN RAISE EXCEPTION 'Your demo wallet is not ready yet.'; END IF;
  IF wallet_row.demo_balance - wallet_row.reserved_demo < g.commit_value THEN RAISE EXCEPTION 'You do not have enough available demo money to join.'; END IF;
  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (g.id, uid, public.group_display_name(uid), 'member', 'committed', now(), g.commit_value)
  ON CONFLICT (group_id, user_id) DO NOTHING;
  IF NOT FOUND THEN RETURN g.id; END IF;
  UPDATE public.wallets SET reserved_demo = reserved_demo + g.commit_value WHERE user_id = uid;
  RETURN g.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_study_group(_user_id uuid, _group_id uuid)
 RETURNS TABLE(started_at timestamp with time zone, ends_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := _user_id; g public.study_groups; started timestamptz; ending timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  IF g.creator_id <> uid THEN RAISE EXCEPTION 'Only the organizer can start the session.'; END IF;
  IF g.status = 'active' AND g.started_at IS NOT NULL AND g.ends_at IS NOT NULL THEN RETURN QUERY SELECT g.started_at, g.ends_at; RETURN; END IF;
  IF g.status = 'ended' THEN RAISE EXCEPTION 'This group session has already finished.'; END IF;
  -- Clear stale locks for every participant before the blocking check.
  PERFORM public.release_stale_commitments(m.user_id)
    FROM public.group_members m WHERE m.group_id = g.id AND m.status = 'committed';
  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status = 'committed') < 2 THEN RAISE EXCEPTION 'At least one other committed member must be present.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members gm JOIN public.active_sessions a ON a.user_id = gm.user_id WHERE gm.group_id = g.id AND gm.status = 'committed') THEN RAISE EXCEPTION 'A participant already has another session running.'; END IF;
  started := now(); ending := started + make_interval(mins => g.duration_minutes);
  INSERT INTO public.active_sessions (user_id, goal, duration_minutes, value, mode, started_at)
  SELECT user_id, g.goal, g.duration_minutes, g.commit_value, 'group:' || g.mode, started FROM public.group_members WHERE group_id = g.id AND status = 'committed';
  UPDATE public.group_members SET status = 'joined', joined_at = started WHERE group_id = g.id AND status = 'committed';
  UPDATE public.study_groups SET status = 'active', started_at = started, ends_at = ending WHERE id = g.id;
  RETURN QUERY SELECT started, ending;
END;
$function$;

-- 5. Realtime for live lobby/session updates.
ALTER TABLE public.study_groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_groups;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;