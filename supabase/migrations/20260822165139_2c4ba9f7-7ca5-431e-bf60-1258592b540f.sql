-- Group data can only be modified through trusted server logic
REVOKE DELETE ON public.study_groups FROM anon, authenticated;
REVOKE DELETE ON public.group_members FROM anon, authenticated;
REVOKE SELECT ON public.study_groups FROM anon;
REVOKE SELECT ON public.group_members FROM anon;
GRANT SELECT ON public.study_groups TO authenticated;
GRANT SELECT ON public.group_members TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
GRANT ALL ON public.group_members TO service_role;

DROP POLICY IF EXISTS study_groups_delete_creator ON public.study_groups;
CREATE POLICY study_groups_no_client_delete ON public.study_groups
  FOR DELETE TO anon, authenticated USING (false);
CREATE POLICY group_members_no_client_delete ON public.group_members
  FOR DELETE TO anon, authenticated USING (false);