CREATE TABLE IF NOT EXISTS public.leaderboard_totals (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'New User',
  total_minutes bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leaderboard_totals TO authenticated;
GRANT ALL ON public.leaderboard_totals TO service_role;

ALTER TABLE public.leaderboard_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboard_totals_select_authenticated"
  ON public.leaderboard_totals FOR SELECT TO authenticated USING (true);
CREATE POLICY "leaderboard_totals_no_client_insert"
  ON public.leaderboard_totals FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "leaderboard_totals_no_client_update"
  ON public.leaderboard_totals FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "leaderboard_totals_no_client_delete"
  ON public.leaderboard_totals FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_total(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.leaderboard_totals (user_id, display_name, total_minutes, updated_at)
  SELECT p.id,
         p.display_name,
         COALESCE((
           SELECT SUM(s.duration_minutes)
             FROM public.focus_sessions s
            WHERE s.user_id = p.id AND s.status = 'completed'
         ), 0)::bigint,
         now()
    FROM public.profiles p
   WHERE p.id = _user_id
  ON CONFLICT (user_id) DO UPDATE
     SET display_name = EXCLUDED.display_name,
         total_minutes = EXCLUDED.total_minutes,
         updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.refresh_leaderboard_total(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.leaderboard_totals_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_leaderboard_total(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_totals_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_leaderboard_total(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_leaderboard_from_session ON public.focus_sessions;
CREATE TRIGGER trg_leaderboard_from_session
AFTER INSERT OR UPDATE OR DELETE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_totals_from_session();

DROP TRIGGER IF EXISTS trg_leaderboard_from_profile ON public.profiles;
CREATE TRIGGER trg_leaderboard_from_profile
AFTER INSERT OR UPDATE OF display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_totals_from_profile();

INSERT INTO public.leaderboard_totals (user_id, display_name, total_minutes, updated_at)
SELECT p.id,
       p.display_name,
       COALESCE((
         SELECT SUM(s.duration_minutes)
           FROM public.focus_sessions s
          WHERE s.user_id = p.id AND s.status = 'completed'
       ), 0)::bigint,
       now()
  FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
   SET display_name = EXCLUDED.display_name,
       total_minutes = EXCLUDED.total_minutes,
       updated_at = now();

ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_totals;