ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'native';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'active_sessions_status_check'
  ) THEN
    ALTER TABLE public.active_sessions
      ADD CONSTRAINT active_sessions_status_check
      CHECK (status IN ('active', 'failed'));
  END IF;
END $$;

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

  UPDATE public.active_sessions
     SET status = 'failed',
         failure_reason = COALESCE(failure_reason, 'heartbeat_timeout')
   WHERE user_id = auth.uid()
     AND status = 'active'
     AND platform = 'web'
     AND last_heartbeat < now() - interval '30 seconds';

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

CREATE OR REPLACE FUNCTION public.fail_web_session(_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'none';
  END IF;

  UPDATE public.active_sessions
     SET status = 'failed',
         failure_reason = COALESCE(NULLIF(_reason, ''), 'unknown')
   WHERE user_id = auth.uid()
     AND status = 'active';

  RETURN 'failed';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_web_session()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN true;
  END IF;

  WITH removed AS (
    DELETE FROM public.active_sessions
     WHERE user_id = auth.uid()
       AND status = 'active'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM removed) INTO v_deleted;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.web_session_heartbeat() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_web_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_web_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.web_session_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_web_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_web_session() TO authenticated;