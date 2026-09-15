-- The RLS policy group_members_select_same_group calls this function as the
-- querying role, so `authenticated` must retain EXECUTE or every group read
-- fails with 42501. Kept SECURITY DEFINER + fixed search_path; it only tells
-- the caller whether they themselves belong to a group.
GRANT EXECUTE ON FUNCTION public.i_am_group_participant(uuid) TO authenticated;