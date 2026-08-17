CREATE TABLE public.academic_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  exam_date date,
  revised boolean NOT NULL DEFAULT false,
  revised_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_subjects TO authenticated;
GRANT ALL ON public.academic_subjects TO service_role;

ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_subjects_select_own ON public.academic_subjects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY academic_subjects_insert_own ON public.academic_subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY academic_subjects_update_own ON public.academic_subjects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY academic_subjects_delete_own ON public.academic_subjects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER academic_subjects_touch BEFORE UPDATE ON public.academic_subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS weekly_goal_hours numeric NOT NULL DEFAULT 14;