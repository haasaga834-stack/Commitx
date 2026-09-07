-- 1. Revoke blanket PUBLIC/anon execution on all SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.cancel_study_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_food_coins() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_study_group(uuid, text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_web_session(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_web_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_display_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_invite_preview(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.i_am_group_participant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard_top(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard_totals_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard_totals_from_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_study_lobby(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_total(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stale_commitments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_expired_study_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_study_group_member(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_study_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_session_heartbeat() FROM PUBLIC, anon, authenticated;

-- Server (service role) keeps full access for trusted server functions
GRANT EXECUTE ON FUNCTION public.cancel_study_group(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.community_food_coins() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_study_group(uuid, text, integer, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_web_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_web_session() TO service_role;
GRANT EXECUTE ON FUNCTION public.group_display_name(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.group_invite_preview(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_study_lobby(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_total(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stale_commitments(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_expired_study_group(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_study_group_member(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_study_group(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_session_heartbeat() TO service_role;

-- Signed-in users only need the web-session RPCs called from the browser
-- and the helper used inside row-level policies
GRANT EXECUTE ON FUNCTION public.web_session_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_web_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_web_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_display_name(uuid) TO authenticated;

-- 2. Wallets: remove any anonymous surface, scope policies to signed-in users only
REVOKE ALL ON public.wallets FROM PUBLIC, anon;
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS wallets_no_client_insert ON public.wallets;
CREATE POLICY wallets_no_client_insert ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS wallets_no_client_update ON public.wallets;
CREATE POLICY wallets_no_client_update ON public.wallets
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS wallets_no_client_delete ON public.wallets;
CREATE POLICY wallets_no_client_delete ON public.wallets
  FOR DELETE TO authenticated
  USING (false);

-- 3. Leaderboard totals: replace broad read with own-row only;
-- the public leaderboard is served through the leaderboard_top function instead
REVOKE ALL ON public.leaderboard_totals FROM PUBLIC, anon;
GRANT SELECT ON public.leaderboard_totals TO authenticated;
GRANT ALL ON public.leaderboard_totals TO service_role;

DROP POLICY IF EXISTS leaderboard_totals_select_authenticated ON public.leaderboard_totals;
CREATE POLICY leaderboard_totals_select_own ON public.leaderboard_totals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);