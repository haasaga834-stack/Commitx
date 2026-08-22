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
  IF g.id IS NULL THEN RETURN true; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'This group has already started.'; END IF;
  SELECT * INTO m FROM public.group_members WHERE group_id = g.id AND user_id = _user_id FOR UPDATE;
  IF m.id IS NULL THEN RETURN true; END IF;
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

REVOKE ALL ON FUNCTION public.leave_study_lobby(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_study_lobby(uuid, uuid) TO service_role;