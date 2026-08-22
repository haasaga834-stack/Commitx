-- study_groups defense-in-depth
ALTER TABLE public.study_groups
  ADD CONSTRAINT study_groups_code_format CHECK (code ~ '^[A-Z0-9]{6}$'),
  ADD CONSTRAINT study_groups_duration_bounds CHECK (duration_minutes BETWEEN 10 AND 360),
  ADD CONSTRAINT study_groups_commit_bounds CHECK (commit_value BETWEEN 50 AND 500),
  ADD CONSTRAINT study_groups_mode_valid CHECK (mode IN ('standard','verified')),
  ADD CONSTRAINT study_groups_status_valid CHECK (status IN ('lobby','active','ended'));

-- group_members defense-in-depth
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_role_valid CHECK (role IN ('creator','member')),
  ADD CONSTRAINT group_members_status_valid CHECK (status IN ('committed','joined','completed','failed','left'));

CREATE OR REPLACE FUNCTION public.enforce_group_member_invariants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE g public.study_groups;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = NEW.group_id;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF NEW.held_amount <> g.commit_value AND NEW.settled_at IS NULL THEN
    RAISE EXCEPTION 'Held amount must match the group commitment';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.settled_at IS NOT NULL THEN
      RAISE EXCEPTION 'A settled membership cannot be modified';
    END IF;
    IF NEW.group_id <> OLD.group_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Membership ownership cannot change';
    END IF;
    IF NEW.held_amount <> OLD.held_amount THEN
      RAISE EXCEPTION 'Held amount cannot change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_group_member_invariants_trigger
BEFORE INSERT OR UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_invariants();

-- wallets defense-in-depth
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_demo_bounds CHECK (demo_balance >= 0 AND demo_balance <= 1000),
  ADD CONSTRAINT wallets_reserved_bounds CHECK (reserved_demo >= 0 AND reserved_demo <= demo_balance),
  ADD CONSTRAINT wallets_no_real_money CHECK (real_balance = 0);

-- focus_sessions defense-in-depth
ALTER TABLE public.focus_sessions
  ADD CONSTRAINT focus_sessions_value_bounds CHECK (value >= 0 AND value <= 500),
  ADD CONSTRAINT focus_sessions_demo_bounds CHECK (demo_used >= 0 AND demo_used <= 500),
  ADD CONSTRAINT focus_sessions_no_real_money CHECK (real_used = 0),
  ADD CONSTRAINT focus_sessions_duration_bounds CHECK (duration_minutes BETWEEN 1 AND 720),
  ADD CONSTRAINT focus_sessions_status_valid CHECK (status IN ('completed','failed','active','ended'));