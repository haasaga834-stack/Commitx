DROP POLICY IF EXISTS study_groups_insert_own ON public.study_groups;
CREATE POLICY study_groups_no_client_insert ON public.study_groups FOR INSERT TO anon, authenticated WITH CHECK (false);
REVOKE INSERT, UPDATE ON public.study_groups FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.group_members FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.focus_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_group_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.duration_minutes < 10 OR NEW.duration_minutes > 360 THEN
    RAISE EXCEPTION 'Invalid group duration';
  END IF;
  IF NEW.commit_value < 50 OR NEW.commit_value > 500 THEN
    RAISE EXCEPTION 'Invalid commitment amount';
  END IF;
  IF NEW.mode NOT IN ('standard', 'verified') THEN
    RAISE EXCEPTION 'Invalid session mode';
  END IF;
  IF NEW.status <> 'lobby' THEN
    RAISE EXCEPTION 'New groups must start in the lobby';
  END IF;
  IF NEW.creator_id IS NULL THEN
    RAISE EXCEPTION 'Groups require a creator';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_session_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Sessions require an owner';
  END IF;
  IF NEW.duration_minutes IS NULL OR NEW.duration_minutes < 1 OR NEW.duration_minutes > 720 THEN
    RAISE EXCEPTION 'Invalid session duration';
  END IF;
  IF NEW.status NOT IN ('completed', 'failed', 'active', 'ended') THEN
    RAISE EXCEPTION 'Invalid session status';
  END IF;
  IF COALESCE(NEW.demo_used, 0) < 0 OR COALESCE(NEW.demo_used, 0) > 500 THEN
    RAISE EXCEPTION 'Invalid commitment amount for session';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_session_integrity_trigger ON public.focus_sessions;
CREATE TRIGGER enforce_session_integrity_trigger
BEFORE INSERT OR UPDATE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_session_integrity();

CREATE OR REPLACE FUNCTION public.enforce_wallet_bounds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.demo_balance, 0) < 0 OR COALESCE(NEW.demo_balance, 0) > 1000 THEN
    RAISE EXCEPTION 'Invalid demo balance';
  END IF;
  IF COALESCE(NEW.real_balance, 0) <> 0 THEN
    RAISE EXCEPTION 'Real money balances are not available';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_wallet_bounds_trigger ON public.wallets;
CREATE TRIGGER enforce_wallet_bounds_trigger
BEFORE INSERT OR UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.enforce_wallet_bounds();