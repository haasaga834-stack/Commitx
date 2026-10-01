CREATE OR REPLACE FUNCTION public.i_am_group_participant(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.group_members
     WHERE group_id = _group_id
       AND user_id = auth.uid()
       AND status IN ('committed', 'joined')
  );
$$;

REVOKE ALL ON FUNCTION public.i_am_group_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO authenticated, service_role;