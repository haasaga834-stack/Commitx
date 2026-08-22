REVOKE ALL ON FUNCTION public.group_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.group_display_name(uuid) TO service_role;