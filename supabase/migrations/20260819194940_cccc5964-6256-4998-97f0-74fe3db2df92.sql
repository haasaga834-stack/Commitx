-- group_invite_preview is only called from a trusted server function; signed-in
-- users must not be able to probe invite codes directly.
REVOKE ALL ON FUNCTION public.group_invite_preview(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.group_invite_preview(text) TO service_role;