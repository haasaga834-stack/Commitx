CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE TABLE public.student_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  course_year text,
  review text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  public_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_reviews_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT student_reviews_display_name_length CHECK (char_length(trim(display_name)) BETWEEN 1 AND 60),
  CONSTRAINT student_reviews_course_year_length CHECK (course_year IS NULL OR char_length(trim(course_year)) <= 80),
  CONSTRAINT student_reviews_review_length CHECK (char_length(trim(review)) BETWEEN 20 AND 500)
);

GRANT SELECT, INSERT ON public.student_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_reviews TO authenticated;
GRANT ALL ON public.student_reviews TO service_role;

ALTER TABLE public.student_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved student reviews"
ON public.student_reviews
FOR SELECT
TO anon, authenticated
USING (status = 'approved');

CREATE POLICY "Anyone can submit pending student reviews"
ON public.student_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');

CREATE POLICY "Admins can read all student reviews"
ON public.student_reviews
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can moderate student reviews"
ON public.student_reviews
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete student reviews"
ON public.student_reviews
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER student_reviews_touch
BEFORE UPDATE ON public.student_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

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

  IF lower(COALESCE(NEW.email, '')) = 'commitx07@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;