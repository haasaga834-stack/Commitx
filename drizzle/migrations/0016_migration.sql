-- The 1000-coin cap made every recording fail once a user's ledger passed 1000.
-- enforce_wallet_bounds() already validates balances (0..1,000,000).
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_demo_bounds;