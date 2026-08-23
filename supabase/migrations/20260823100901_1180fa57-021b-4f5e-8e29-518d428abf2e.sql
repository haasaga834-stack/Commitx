-- Group Study lifecycle hardening: idempotent start, clearer blocking errors,
-- and safer cleanup of abandoned/stale group locks.

CREATE OR REPLACE FUNCTION public.start_study_group(_user_id uuid, _group_id uuid)
 RETURNS TABLE(started_at timestamp with time zone, ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := _user_id; g public.study_groups; started timestamptz; ending timestamptz; busy_user uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  IF g.creator_id <> uid THEN RAISE EXCEPTION 'Only the organizer can start the session.'; END IF;
  -- Idempotent: a second tap (or a retry after a dropped response) returns the
  -- one authoritative window instead of creating a conflicting one.
  IF g.status = 'active' AND g.started_at IS NOT NULL AND g.ends_at IS NOT NULL THEN
    RETURN QUERY SELECT g.started_at, g.ends_at; RETURN;
  END IF;
  IF g.status = 'ended' THEN RAISE EXCEPTION 'This group session has already finished.'; END IF;

  -- Clear stale locks for every participant before the blocking check.
  PERFORM public.release_stale_commitments(m.user_id)
    FROM public.group_members m WHERE m.group_id = g.id AND m.status = 'committed';

  -- Leftover group session rows from a group that is no longer running can
  -- never block a fresh start.
  DELETE FROM public.active_sessions a
   USING public.group_members m
   WHERE m.group_id = g.id
     AND m.status = 'committed'
     AND a.user_id = m.user_id
     AND a.mode LIKE 'group:%';

  IF (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND status = 'committed') < 2 THEN
    RAISE EXCEPTION 'At least one other committed member must be present.';
  END IF;

  SELECT gm.user_id INTO busy_user
    FROM public.group_members gm
    JOIN public.active_sessions a ON a.user_id = gm.user_id
   WHERE gm.group_id = g.id AND gm.status = 'committed'
   LIMIT 1;
  IF busy_user IS NOT NULL THEN
    RAISE EXCEPTION '% still has another CommitX session running. They must finish it first.',
      public.group_display_name(busy_user);
  END IF;

  started := now(); ending := started + make_interval(mins => g.duration_minutes);

  -- One authoritative start/end timestamp for every participant.
  INSERT INTO public.active_sessions (user_id, goal, duration_minutes, value, mode, started_at)
  SELECT user_id, g.goal, g.duration_minutes, g.commit_value, 'group:' || g.mode, started
    FROM public.group_members WHERE group_id = g.id AND status = 'committed'
  ON CONFLICT (user_id) DO UPDATE
    SET goal = EXCLUDED.goal,
        duration_minutes = EXCLUDED.duration_minutes,
        value = EXCLUDED.value,
        mode = EXCLUDED.mode,
        started_at = EXCLUDED.started_at;

  UPDATE public.group_members SET status = 'joined', joined_at = started WHERE group_id = g.id AND status = 'committed';
  UPDATE public.study_groups SET status = 'active', started_at = started, ends_at = ending WHERE id = g.id;
  RETURN QUERY SELECT started, ending;
END;
$function$;

-- Cleanup: also release lobbies that were never started and are older than the
-- window a user could plausibly still be waiting in (1 hour of no activity),
-- and drop group session rows whose group no longer exists.
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

  -- Group session rows for groups that are no longer running at all.
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