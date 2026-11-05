CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.find_study_buddies(_education text DEFAULT NULL::text, _sex text DEFAULT NULL::text, _focusing_only boolean DEFAULT false, _limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, education text, age text, sex text, week_minutes bigint, focusing boolean, requested boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, p.avatar_url, NULLIF(trim(p.education), ''), NULL::text, NULL::text,
    COALESCE((SELECT sum(f.duration_minutes) FROM public.focus_sessions f
              WHERE f.user_id = p.id AND f.status = 'completed' AND f.created_at >= now() - interval '7 days'), 0)::bigint AS wm,
    EXISTS (SELECT 1 FROM public.active_sessions a WHERE a.user_id = p.id AND a.status = 'active'),
    EXISTS (SELECT 1 FROM public.buddy_requests r WHERE r.from_id = uid AND r.to_id = p.id AND r.status = 'pending')
  FROM public.profiles p
  WHERE p.id <> uid
    AND p.buddy_discoverable = true
    AND public.current_buddy_id(p.id) IS NULL
    AND (_education IS NULL OR trim(_education) = '' OR regexp_replace(lower(COALESCE(p.education,'')), '[^a-z0-9]', '', 'g') LIKE '%' || regexp_replace(lower(_education), '[^a-z0-9]', '', 'g') || '%')
    AND (_sex IS NULL OR _sex = '' OR lower(p.sex) = lower(_sex))
    AND (NOT _focusing_only OR EXISTS (SELECT 1 FROM public.active_sessions a WHERE a.user_id = p.id AND a.status = 'active'))
  ORDER BY 8 DESC, 7 DESC
  LIMIT LEAST(GREATEST(_limit, 1), 50);
END $function$;