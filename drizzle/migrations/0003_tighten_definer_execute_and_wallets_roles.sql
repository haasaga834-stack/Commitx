-- 1) Wallets: ensure no anonymous access at all (policies scoped to authenticated, grants revoked)
REVOKE ALL ON TABLE public.wallets FROM anon;
REVOKE ALL ON TABLE public.wallets FROM PUBLIC;
GRANT SELECT ON TABLE public.wallets TO authenticated;
GRANT ALL ON TABLE public.wallets TO service_role;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_insert ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_update ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_delete ON public.wallets;

CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY wallets_no_client_insert ON public.wallets
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY wallets_no_client_update ON public.wallets
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY wallets_no_client_delete ON public.wallets
  FOR DELETE TO authenticated USING (false);

-- 2) SECURITY DEFINER functions signed-in users must not call directly.
--    These are only used internally / via service_role.
REVOKE ALL ON FUNCTION public.group_display_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.i_am_group_participant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.group_display_name(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO service_role;