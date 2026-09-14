CREATE OR REPLACE FUNCTION public.touch_paused_web_session()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'none';
  END IF;

  UPDATE public.active_sessions
     SET last_heartbeat = now()
   WHERE user_id = auth.uid()
     AND status = 'active'
     AND platform = 'web'
  RETURNING status INTO v_status;

  IF v_status IS NULL THEN
    SELECT status INTO v_status
      FROM public.active_sessions
     WHERE user_id = auth.uid();
  END IF;

  RETURN COALESCE(v_status, 'none');
END;
$function$;

REVOKE ALL ON FUNCTION public.touch_paused_web_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_paused_web_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_paused_web_session() TO service_role;