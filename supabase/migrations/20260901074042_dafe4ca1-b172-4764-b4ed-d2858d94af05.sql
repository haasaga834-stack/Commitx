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

  -- Brief connectivity drops must not end a session: allow a 3 minute gap.
  UPDATE public.active_sessions
     SET status = 'failed',
         failure_reason = COALESCE(failure_reason, 'heartbeat_timeout')
   WHERE user_id = auth.uid()
     AND status = 'active'
     AND platform = 'web'
     AND last_heartbeat < now() - interval '3 minutes';

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

ALTER TABLE public.active_sessions
  ALTER COLUMN last_heartbeat SET DEFAULT now();