ALTER TABLE public.study_plans
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS commit_value integer;