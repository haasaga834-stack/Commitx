-- Group study: shared, server-timed commitments

CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  goal text NOT NULL DEFAULT 'Group Study',
  duration_minutes integer NOT NULL DEFAULT 30,
  commit_value integer NOT NULL DEFAULT 50,
  mode text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'lobby',
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Friend',
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'committed',
  accepted_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON public.group_members(user_id);
CREATE INDEX study_groups_creator_idx ON public.study_groups(creator_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;

CREATE POLICY study_groups_select_involved ON public.study_groups
  FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR public.is_group_member(id, auth.uid()));

CREATE POLICY study_groups_insert_own ON public.study_groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY study_groups_update_creator ON public.study_groups
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE POLICY study_groups_delete_creator ON public.study_groups
  FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY group_members_select_involved ON public.group_members
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_group_member(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.creator_id = auth.uid())
  );

CREATE POLICY group_members_insert_self ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY group_members_update_self ON public.group_members
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY group_members_delete_self ON public.group_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER study_groups_touch
  BEFORE UPDATE ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Terms preview for an invite code, before the friend is a member.
CREATE OR REPLACE FUNCTION public.group_invite_preview(_code text)
RETURNS TABLE (
  id uuid,
  goal text,
  duration_minutes integer,
  commit_value integer,
  mode text,
  status text,
  creator_name text,
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.goal, g.duration_minutes, g.commit_value, g.mode, g.status,
         COALESCE(p.display_name, 'A friend') AS creator_name,
         (SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id AND m.status <> 'left') AS member_count
  FROM public.study_groups g
  LEFT JOIN public.profiles p ON p.id = g.creator_id
  WHERE upper(g.code) = upper(_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.group_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_invite_preview(text) TO authenticated, service_role;