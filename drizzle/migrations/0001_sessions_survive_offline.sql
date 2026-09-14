-- Once a session has started, losing internet must never end it.
-- The heartbeat no longer fails sessions for missed check-ins, and it repairs
-- any session that was previously failed purely because of a connectivity gap.
CREATE OR REPLACE FUNCTION public.web_session_heartbeat()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'none';
  END IF;

  -- Repair sessions that were only marked failed because check-ins stopped
  -- while the device was offline.
  UPDATE public.active_sessions
     SET status = 'active',
         failure_reason = NULL,
         last_heartbeat = now()
   WHERE user_id = auth.uid()
     AND status = 'failed'
     AND failure_reason IN ('heartbeat_timeout', 'web_heartbeat_timeout');

  UPDATE public.active_sessions
     SET last_heartbeat = now()
   WHERE user_id = auth.uid()
     AND status = 'active'
  RETURNING status INTO v_status;

  IF v_status IS NULL THEN
    SELECT status INTO v_status
      FROM public.active_sessions
     WHERE user_id = auth.uid();
  END IF;

  RETURN COALESCE(v_status, 'none');
END;
$$;

REVOKE ALL ON FUNCTION public.web_session_heartbeat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.web_session_heartbeat() TO authenticated, service_role;