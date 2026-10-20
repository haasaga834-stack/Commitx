CREATE OR REPLACE FUNCTION public.recompute_wallet(_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_balance integer;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  v_balance := public.ledger_coin_balance(_user_id);
  UPDATE public.wallets SET coin_balance = v_balance, coins_reserved = LEAST(coins_reserved, v_balance)
   WHERE user_id = _user_id AND (coin_balance IS DISTINCT FROM v_balance OR coins_reserved > v_balance);
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = _user_id)
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    INSERT INTO public.wallets (user_id, coin_balance) VALUES (_user_id, v_balance)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN v_balance;
END $$;
REVOKE ALL ON FUNCTION public.recompute_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_wallet(uuid) TO service_role;