-- Referrals: explicitly block client-side writes (only server/admin code may write)
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM anon, authenticated;
GRANT ALL ON public.referrals TO service_role;

DROP POLICY IF EXISTS referrals_no_client_insert ON public.referrals;
CREATE POLICY referrals_no_client_insert ON public.referrals FOR INSERT TO authenticated, anon WITH CHECK (false);
DROP POLICY IF EXISTS referrals_no_client_update ON public.referrals;
CREATE POLICY referrals_no_client_update ON public.referrals FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS referrals_no_client_delete ON public.referrals;
CREATE POLICY referrals_no_client_delete ON public.referrals FOR DELETE TO authenticated, anon USING (false);

-- Trigger-only SECURITY DEFINER function must not be callable via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Public read-only aggregate RPCs: keep signed-in access only, harden search_path
REVOKE ALL ON FUNCTION public.leaderboard_top(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_food_coins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_food_coins() TO authenticated;
ALTER FUNCTION public.leaderboard_top(integer) SET search_path = public;
ALTER FUNCTION public.community_food_coins() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;