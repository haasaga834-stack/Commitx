ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS focus_shield_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS focus_shield_status text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS focus_shield_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS focus_shield_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS focus_shield_packages text[] NOT NULL DEFAULT '{}'::text[];