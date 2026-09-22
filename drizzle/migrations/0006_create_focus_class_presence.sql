CREATE TABLE public.focus_class_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presence_key text NOT NULL UNIQUE,
  duration_minutes integer NOT NULL DEFAULT 25,
  sound text NOT NULL DEFAULT 'silence',
  status text NOT NULL DEFAULT 'active',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_heartbeat timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  left_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.focus_class_presence TO anon, authenticated;
GRANT ALL ON public.focus_class_presence TO service_role;

ALTER TABLE public.focus_class_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Focus class presence is public aggregate data"
ON public.focus_class_presence
FOR SELECT
TO anon, authenticated
USING (true);

CREATE TRIGGER focus_class_presence_touch
BEFORE UPDATE ON public.focus_class_presence
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_focus_class_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.focus_class_presence
     SET status = 'left',
         left_at = COALESCE(left_at, now()),
         updated_at = now()
   WHERE status = 'active'
     AND last_heartbeat < now() - interval '45 seconds';
$$;

CREATE OR REPLACE FUNCTION public.focus_class_active_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE active_count integer;
BEGIN
  PERFORM public.cleanup_focus_class_presence();
  SELECT count(*)::integer INTO active_count
    FROM public.focus_class_presence
   WHERE status = 'active'
     AND last_heartbeat >= now() - interval '45 seconds';
  RETURN COALESCE(active_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.focus_class_touch(_presence_key text, _duration_minutes integer DEFAULT 25, _sound text DEFAULT 'silence')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE clean_key text := left(trim(COALESCE(_presence_key, '')), 80);
DECLARE clean_duration integer := LEAST(GREATEST(COALESCE(_duration_minutes, 25), 25), 360);
DECLARE clean_sound text := CASE WHEN COALESCE(_sound, 'silence') IN ('rain', 'forest', 'ocean', 'campfire', 'deep-focus', 'silence') THEN COALESCE(_sound, 'silence') ELSE 'silence' END;
BEGIN
  IF clean_key = '' THEN
    RAISE EXCEPTION 'Presence key is required.';
  END IF;

  PERFORM public.cleanup_focus_class_presence();

  INSERT INTO public.focus_class_presence (presence_key, duration_minutes, sound, status, started_at, last_heartbeat, completed_at, left_at)
  VALUES (clean_key, clean_duration, clean_sound, 'active', now(), now(), NULL, NULL)
  ON CONFLICT (presence_key) DO UPDATE
     SET duration_minutes = EXCLUDED.duration_minutes,
         sound = EXCLUDED.sound,
         status = 'active',
         started_at = CASE
           WHEN public.focus_class_presence.status = 'active'
            AND public.focus_class_presence.last_heartbeat >= now() - interval '45 seconds'
           THEN public.focus_class_presence.started_at
           ELSE now()
         END,
         last_heartbeat = now(),
         completed_at = NULL,
         left_at = NULL;

  RETURN public.focus_class_active_count();
END;
$$;

CREATE OR REPLACE FUNCTION public.focus_class_leave(_presence_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE clean_key text := left(trim(COALESCE(_presence_key, '')), 80);
BEGIN
  IF clean_key <> '' THEN
    UPDATE public.focus_class_presence
       SET status = 'left',
           left_at = now(),
           last_heartbeat = now()
     WHERE presence_key = clean_key
       AND status = 'active';
  END IF;
  RETURN public.focus_class_active_count();
END;
$$;

CREATE OR REPLACE FUNCTION public.focus_class_complete(_presence_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE clean_key text := left(trim(COALESCE(_presence_key, '')), 80);
BEGIN
  IF clean_key <> '' THEN
    UPDATE public.focus_class_presence
       SET status = 'completed',
           completed_at = now(),
           last_heartbeat = now()
     WHERE presence_key = clean_key
       AND status = 'active';
  END IF;
  RETURN public.focus_class_active_count();
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_focus_class_presence() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.focus_class_active_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.focus_class_touch(text, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.focus_class_leave(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.focus_class_complete(text) TO anon, authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_class_presence;