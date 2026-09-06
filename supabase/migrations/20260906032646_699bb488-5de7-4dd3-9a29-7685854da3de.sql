CREATE OR REPLACE FUNCTION public.leaderboard_totals_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _uid := OLD.user_id;
  ELSE
    _uid := NEW.user_id;
  END IF;
  PERFORM public.refresh_leaderboard_total(_uid);
  RETURN NULL;
END;
$$;