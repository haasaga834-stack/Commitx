CREATE OR REPLACE FUNCTION public.create_buddy_invite() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c text; existing text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF public.current_buddy_id(uid) IS NOT NULL THEN RAISE EXCEPTION 'You already have a study buddy.'; END IF;
  SELECT invite_code INTO existing FROM public.study_buddies WHERE inviter_id = uid AND status = 'pending' LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  LOOP
    c := upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '01', ''), 1, 6));
    EXIT WHEN length(c) = 6 AND NOT EXISTS (SELECT 1 FROM public.study_buddies WHERE invite_code = c);
  END LOOP;
  INSERT INTO public.study_buddies (inviter_id, invite_code) VALUES (uid, c);
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.my_group_pot(_group_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid())
              THEN public.group_pot_amount(_group_id) ELSE 0 END
$$;
REVOKE EXECUTE ON FUNCTION public.group_pot_amount(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.my_group_pot(uuid) TO authenticated;