REVOKE ALL ON FUNCTION public.is_group_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_participant(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.release_stale_commitments(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stale_commitments(uuid) TO service_role;