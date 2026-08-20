-- 1) Wallets and focus sessions: no direct client writes; server recomputes them.
DROP POLICY IF EXISTS wallets_insert_own ON public.wallets;
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_no_client_insert ON public.wallets FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY wallets_no_client_update ON public.wallets FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS sessions_insert_own ON public.focus_sessions;
DROP POLICY IF EXISTS sessions_update_own ON public.focus_sessions;
CREATE POLICY sessions_no_client_insert ON public.focus_sessions FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY sessions_no_client_update ON public.focus_sessions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

-- 2) Group membership: server-only writes (invite-code flow), self-service delete kept.
DROP POLICY IF EXISTS group_members_insert_self ON public.group_members;
DROP POLICY IF EXISTS group_members_update_self ON public.group_members;
CREATE POLICY group_members_no_client_insert ON public.group_members FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY group_members_no_client_update ON public.group_members FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

-- Non-recursive visibility: own membership rows only.
DROP POLICY IF EXISTS group_members_select_involved ON public.group_members;
CREATE POLICY group_members_select_own ON public.group_members FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS study_groups_select_involved ON public.study_groups;
CREATE POLICY study_groups_select_involved ON public.study_groups FOR SELECT TO authenticated
USING (
  auth.uid() = creator_id
  OR EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = study_groups.id AND m.user_id = auth.uid()
  )
);

-- Group terms are set at creation and changed only by trusted server logic.
DROP POLICY IF EXISTS study_groups_update_creator ON public.study_groups;
CREATE POLICY study_groups_no_client_update ON public.study_groups FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

-- Helper is no longer referenced by any policy.
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);

-- 3) Database-level enforcement of join rules, independent of write path.
CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_user_key
  ON public.group_members (group_id, user_id);

CREATE OR REPLACE FUNCTION public.enforce_group_member_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  g public.study_groups;
  member_count integer;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = NEW.group_id;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF NEW.user_id <> g.creator_id THEN
    IF g.status <> 'lobby' THEN
      RAISE EXCEPTION 'This group has already started';
    END IF;
  END IF;

  SELECT count(*) INTO member_count FROM public.group_members WHERE group_id = NEW.group_id;
  IF member_count >= 5 THEN
    RAISE EXCEPTION 'This group is full';
  END IF;

  IF NEW.status NOT IN ('committed', 'joined') THEN
    RAISE EXCEPTION 'Invalid initial member status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_group_member_rules_trigger ON public.group_members;
CREATE TRIGGER enforce_group_member_rules_trigger
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_rules();

CREATE OR REPLACE FUNCTION public.enforce_group_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_group_terms_trigger ON public.study_groups;
CREATE TRIGGER enforce_group_terms_trigger
  BEFORE INSERT ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_terms();