-- Explicit deny-write policies (documented intent) + remove any anonymous access
REVOKE ALL ON public.wallets FROM anon;
REVOKE ALL ON public.focus_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.focus_sessions FROM authenticated;
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.focus_sessions TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.focus_sessions TO service_role;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS sessions_select_own ON public.focus_sessions;
CREATE POLICY sessions_select_own ON public.focus_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS wallets_no_client_insert ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_update ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_delete ON public.wallets;
CREATE POLICY wallets_no_client_insert ON public.wallets FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY wallets_no_client_update ON public.wallets FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY wallets_no_client_delete ON public.wallets FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS sessions_no_client_insert ON public.focus_sessions;
DROP POLICY IF EXISTS sessions_no_client_update ON public.focus_sessions;
DROP POLICY IF EXISTS sessions_no_client_delete ON public.focus_sessions;
CREATE POLICY sessions_no_client_insert ON public.focus_sessions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY sessions_no_client_update ON public.focus_sessions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sessions_no_client_delete ON public.focus_sessions FOR DELETE TO authenticated USING (false);