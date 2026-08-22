ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'leaves';

ALTER TABLE public.study_groups
  DROP CONSTRAINT IF EXISTS study_groups_theme_check;
ALTER TABLE public.study_groups
  ADD CONSTRAINT study_groups_theme_check
  CHECK (theme IN ('leaves', 'fireflies', 'tree', 'moon', 'lotus'));

CREATE OR REPLACE FUNCTION public.create_study_group(
  _user_id uuid,
  _goal text,
  _duration integer,
  _value integer,
  _mode text,
  _theme text DEFAULT 'leaves'
)
 RETURNS TABLE(id uuid, code text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  IF _value < 50 OR _value > 500 THEN RAISE EXCEPTION 'Choose a commitment from 50 to 500.'; END IF;
  IF _mode NOT IN ('standard', 'verified') THEN RAISE EXCEPTION 'Choose a valid session type.'; END IF;
  IF theme_value NOT IN ('leaves', 'fireflies', 'tree', 'moon', 'lotus') THEN theme_value := 'leaves'; END IF;
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
  INSERT INTO public.study_groups (creator_id, code, goal, duration_minutes, commit_value, mode, status, theme)
  VALUES (uid, invite_code, trim(_goal), _duration, _value, _mode, 'lobby', theme_value) RETURNING * INTO new_group;
  INSERT INTO public.group_members (group_id, user_id, display_name, role, status, accepted_at, held_amount)
  VALUES (new_group.id, uid, public.group_display_name(uid), 'creator', 'committed', now(), _value);
  UPDATE public.wallets SET reserved_demo = reserved_demo + _value WHERE user_id = uid;
  RETURN QUERY SELECT new_group.id, new_group.code;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_study_group(uuid, text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_study_group(uuid, text, integer, integer, text, text) TO service_role;