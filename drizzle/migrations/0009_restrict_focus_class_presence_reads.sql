DROP POLICY IF EXISTS "Focus class presence is public aggregate data" ON public.focus_class_presence;

CREATE POLICY "Focus class live presence is public"
ON public.focus_class_presence
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND last_heartbeat > (now() - interval '2 minutes')
);