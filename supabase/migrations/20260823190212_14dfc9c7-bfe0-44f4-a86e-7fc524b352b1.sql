-- 1) Wallets & focus_sessions: server-authoritative only.
DROP POLICY IF EXISTS wallets_delete_own ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_insert ON public.wallets;
DROP POLICY IF EXISTS wallets_no_client_update ON public.wallets;
DROP POLICY IF EXISTS sessions_delete_own ON public.focus_sessions;
DROP POLICY IF EXISTS sessions_no_client_insert ON public.focus_sessions;
DROP POLICY IF EXISTS sessions_no_client_update ON public.focus_sessions;

REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.focus_sessions FROM anon, authenticated;
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.focus_sessions TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.focus_sessions TO service_role;

-- 2) SECURITY DEFINER routines: only trusted server code may call them.
REVOKE EXECUTE ON FUNCTION public.cancel_study_group(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_food_coins() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_study_group(uuid, text, integer, integer, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.group_display_name(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.group_invite_preview(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_study_group(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leaderboard_top(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_study_lobby(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_stale_commitments(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_expired_study_group(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_study_group_member(uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_study_group(uuid, uuid) FROM anon, authenticated;

-- i_am_group_participant stays executable: row-level access rules depend on it
-- and it only reveals whether the caller themselves is in a group.
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO authenticated;