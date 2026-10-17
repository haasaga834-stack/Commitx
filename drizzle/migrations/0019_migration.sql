CREATE OR REPLACE FUNCTION public.focus_class_hash_key(_k text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT 'h:' || encode(sha256(convert_to(left(trim(COALESCE(_k, '')), 80), 'UTF8')), 'hex')
$$;

-- Existing rows held raw (readable) keys; retire them so stored keys are only hashes.
UPDATE public.focus_class_presence
   SET presence_key = public.focus_class_hash_key(presence_key)
 WHERE presence_key NOT LIKE 'h:%';

CREATE OR REPLACE FUNCTION public.focus_class_touch(_presence_key text, _duration_minutes integer DEFAULT 25, _sound text DEFAULT 'silence')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE raw_key text := left(trim(COALESCE(_presence_key, '')), 80);
DECLARE clean_key text;
DECLARE clean_duration integer := LEAST(GREATEST(COALESCE(_duration_minutes, 25), 25), 360);
DECLARE clean_sound text := CASE WHEN COALESCE(_sound, 'silence') IN ('rain','forest','ocean','campfire','deep-focus','silence') THEN COALESCE(_sound, 'silence') ELSE 'silence' END;
BEGIN
  IF raw_key = '' THEN RAISE EXCEPTION 'Presence key is required.'; END IF;
  clean_key := public.focus_class_hash_key(raw_key);
  PERFORM public.cleanup_focus_class_presence();
  INSERT INTO public.focus_class_presence (presence_key, duration_minutes, sound, status, started_at, last_heartbeat, completed_at, left_at)
  VALUES (clean_key, clean_duration, clean_sound, 'active', now(), now(), NULL, NULL)
  ON CONFLICT (presence_key) DO UPDATE
     SET duration_minutes = EXCLUDED.duration_minutes,
         sound = EXCLUDED.sound,
         status = 'active',
         started_at = CASE WHEN public.focus_class_presence.status = 'active'
                            AND public.focus_class_presence.last_heartbeat >= now() - interval '45 seconds'
                           THEN public.focus_class_presence.started_at ELSE now() END,
         last_heartbeat = now(), completed_at = NULL, left_at = NULL;
  RETURN public.focus_class_active_count();
END; $$;

CREATE OR REPLACE FUNCTION public.focus_class_leave(_presence_key text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE raw_key text := left(trim(COALESCE(_presence_key, '')), 80);
BEGIN
  IF raw_key <> '' THEN
    UPDATE public.focus_class_presence
       SET status = 'left', left_at = now(), last_heartbeat = now()
     WHERE presence_key = public.focus_class_hash_key(raw_key) AND status = 'active';
  END IF;
  RETURN public.focus_class_active_count();
END; $$;

CREATE OR REPLACE FUNCTION public.focus_class_complete(_presence_key text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE raw_key text := left(trim(COALESCE(_presence_key, '')), 80);
BEGIN
  IF raw_key <> '' THEN
    UPDATE public.focus_class_presence
       SET status = 'completed', completed_at = now(), last_heartbeat = now()
     WHERE presence_key = public.focus_class_hash_key(raw_key) AND status = 'active';
  END IF;
  RETURN public.focus_class_active_count();
END; $$;

-- Group details readable only by the creator or a current member.
DROP POLICY IF EXISTS study_groups_select_involved ON public.study_groups;
CREATE POLICY study_groups_select_involved ON public.study_groups FOR SELECT TO authenticated
USING (
  auth.uid() = creator_id
  OR EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = study_groups.id AND m.user_id = auth.uid()
      AND m.status IN ('committed', 'joined')
  )
);