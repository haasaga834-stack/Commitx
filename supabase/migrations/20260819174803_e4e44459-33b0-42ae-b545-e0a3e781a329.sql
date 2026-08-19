REVOKE ALL ON FUNCTION public.leaderboard_top(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_food_coins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.community_food_coins() TO service_role;