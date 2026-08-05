REVOKE ALL ON FUNCTION public.leaderboard_top(integer) FROM anon;
REVOKE ALL ON FUNCTION public.community_food_coins() FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;