ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_status_valid;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_status_valid
  CHECK (status IN ('committed','joined','completed','failed','left','expired'));