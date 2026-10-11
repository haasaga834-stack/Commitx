DROP FUNCTION IF EXISTS public.leaderboard_top(integer);
CREATE FUNCTION public.leaderboard_top(_limit integer DEFAULT 10)
RETURNS TABLE(user_id uuid, display_name text, total_minutes bigint, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name,
         COALESCE(SUM(s.duration_minutes), 0)::bigint AS total_minutes,
         p.avatar_url
    FROM public.profiles p
    JOIN public.focus_sessions s ON s.user_id = p.id AND s.status = 'completed'
   GROUP BY p.id, p.display_name, p.avatar_url
   ORDER BY total_minutes DESC, p.display_name ASC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 50)
$$;
REVOKE ALL ON FUNCTION public.leaderboard_top(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(integer) TO service_role;