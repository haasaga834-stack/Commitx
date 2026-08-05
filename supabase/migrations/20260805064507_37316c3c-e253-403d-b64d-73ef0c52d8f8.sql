-- Study plans
CREATE TABLE public.study_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL DEFAULT 'Study',
  time text NOT NULL DEFAULT '18:00',
  duration_minutes integer NOT NULL DEFAULT 60,
  repeat text NOT NULL DEFAULT 'daily',
  weekday integer,
  monthday integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_plans_select_own" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "study_plans_insert_own" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_plans_update_own" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_plans_delete_own" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER study_plans_touch BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX study_plans_user_idx ON public.study_plans (user_id, created_at DESC);

-- To-dos
CREATE TABLE public.todos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos_select_own" ON public.todos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "todos_insert_own" ON public.todos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_update_own" ON public.todos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_delete_own" ON public.todos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER todos_touch BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX todos_user_day_idx ON public.todos (user_id, day);

-- Per-user settings
CREATE TABLE public.user_settings (
  user_id uuid NOT NULL PRIMARY KEY,
  daily_goal_hours numeric NOT NULL DEFAULT 2,
  theme text NOT NULL DEFAULT 'light',
  reminders_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_settings_select_own" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert_own" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update_own" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_delete_own" ON public.user_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_settings_touch BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Create settings row alongside profile/wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(COALESCE(NEW.email, 'New User'), '@', 1)),
    public.generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Real leaderboard: display names + completed minutes only
CREATE OR REPLACE FUNCTION public.leaderboard_top(_limit integer DEFAULT 10)
RETURNS TABLE (user_id uuid, display_name text, total_minutes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.display_name,
         COALESCE(SUM(s.duration_minutes), 0)::bigint AS total_minutes
    FROM public.profiles p
    JOIN public.focus_sessions s
      ON s.user_id = p.id AND s.status = 'completed'
   GROUP BY p.id, p.display_name
   ORDER BY total_minutes DESC, p.display_name ASC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 50)
$$;
REVOKE ALL ON FUNCTION public.leaderboard_top(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(integer) TO authenticated;

-- Community Food Coins: 1 coin per completed focus hour, all users
CREATE OR REPLACE FUNCTION public.community_food_coins()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT FLOOR(COALESCE(SUM(duration_minutes), 0) / 60.0)::bigint
    FROM public.focus_sessions
   WHERE status = 'completed'
$$;
REVOKE ALL ON FUNCTION public.community_food_coins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_food_coins() TO authenticated;