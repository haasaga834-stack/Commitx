REVOKE EXECUTE ON FUNCTION public.release_stale_commitments(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_study_group(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.leave_study_lobby(uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_stale_commitments(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_study_group(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_study_lobby(uuid, uuid) TO service_role;