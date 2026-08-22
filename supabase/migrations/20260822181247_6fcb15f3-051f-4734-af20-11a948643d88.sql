DROP POLICY IF EXISTS group_members_select_same_group ON public.group_members;
DROP FUNCTION IF EXISTS public.is_group_participant(uuid, uuid);

-- Membership check for RLS only: always scoped to the caller, so it cannot be
-- used to probe other people's memberships.
CREATE OR REPLACE FUNCTION public.i_am_group_participant(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.i_am_group_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO authenticated, service_role;

CREATE POLICY group_members_select_same_group ON public.group_members
  FOR SELECT TO authenticated
  USING (public.i_am_group_participant(group_id));