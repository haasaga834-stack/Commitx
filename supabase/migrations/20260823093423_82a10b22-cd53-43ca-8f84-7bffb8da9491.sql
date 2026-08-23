-- Abandoned lobbies (never started, no ends_at) previously blocked new groups forever.
CREATE OR REPLACE FUNCTION public.release_stale_commitments(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE gm record; g record;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  -- Solo/group session rows whose window has elapsed (plus 30 min slack for breaks).
  DELETE FROM public.active_sessions
  WHERE user_id = _user_id
    AND now() > started_at + make_interval(mins => duration_minutes + 30);

  -- Waiting rooms nobody ever started: expire after 3 hours of inactivity.
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
      UPDATE public.wallets SET reserved_demo = greatest(0, reserved_demo - gm.held_amount) WHERE user_id = gm.user_id;
      UPDATE public.group_members SET status = 'expired', settled_at = now() WHERE id = gm.id;
      DELETE FROM public.active_sessions WHERE user_id = gm.user_id;
    END LOOP;
    UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  END LOOP;

  -- Memberships in groups that ended, were cancelled, or whose window elapsed.
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
      SET reserved_demo = greatest(0, reserved_demo - gm.held_amount)
      WHERE user_id = _user_id;
    UPDATE public.group_members
      SET status = 'completed', settled_at = now()
      WHERE id = gm.id;
    DELETE FROM public.active_sessions WHERE user_id = _user_id;
  END LOOP;
END;
$function$;

-- Idempotent cancellation; also usable once a running group's window has elapsed.
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
  -- Already cancelled/deleted: nothing to do.
  IF g.id IS NULL THEN
    PERFORM public.release_stale_commitments(uid);
    RETURN true;
  END IF;
  IF g.creator_id <> uid THEN RAISE EXCEPTION 'Only the organizer can cancel this group.'; END IF;
  IF g.status = 'active' AND g.ends_at IS NOT NULL AND now() < g.ends_at THEN
    RAISE EXCEPTION 'A running group cannot be cancelled.';
  END IF;
  FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND settled_at IS NULL FOR UPDATE LOOP
    UPDATE public.wallets SET reserved_demo = greatest(0, reserved_demo - gm.held_amount) WHERE user_id = gm.user_id;
    DELETE FROM public.active_sessions WHERE user_id = gm.user_id;
  END LOOP;
  DELETE FROM public.study_groups WHERE id = g.id;
  RETURN true;
END;
$function$;

-- Leaving a lobby is idempotent too.
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
    UPDATE public.wallets SET reserved_demo = greatest(0, reserved_demo - m.held_amount) WHERE user_id = _user_id;
  END IF;
  DELETE FROM public.active_sessions WHERE user_id = _user_id;
  DELETE FROM public.group_members WHERE id = m.id;
  -- If the host walked away, the lobby dies with them.
  IF g.creator_id = _user_id THEN
    FOR m IN SELECT * FROM public.group_members WHERE group_id = g.id AND settled_at IS NULL FOR UPDATE LOOP
      UPDATE public.wallets SET reserved_demo = greatest(0, reserved_demo - m.held_amount) WHERE user_id = m.user_id;
      DELETE FROM public.active_sessions WHERE user_id = m.user_id;
    END LOOP;
    DELETE FROM public.study_groups WHERE id = g.id;
  END IF;
  RETURN true;
END;
$function$;