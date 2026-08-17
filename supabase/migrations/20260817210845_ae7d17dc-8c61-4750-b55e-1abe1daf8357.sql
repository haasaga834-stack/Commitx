CREATE TABLE public.active_sessions (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  goal text NOT NULL DEFAULT 'Focus',
  duration_minutes integer NOT NULL DEFAULT 30,
  value integer NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'standard',
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_sessions TO authenticated;
GRANT ALL ON public.active_sessions TO service_role;

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own active session"
ON public.active_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);