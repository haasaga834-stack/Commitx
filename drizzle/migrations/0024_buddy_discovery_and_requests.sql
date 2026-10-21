ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS buddy_discoverable boolean NOT NULL DEFAULT false;

CREATE TABLE public.buddy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL,
  to_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
GRANT ALL ON public.buddy_requests TO service_role;
ALTER TABLE public.buddy_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX buddy_requests_one_pending ON public.buddy_requests (from_id, to_id) WHERE status = 'pending';
CREATE INDEX buddy_requests_to ON public.buddy_requests (to_id, status);

CREATE OR REPLACE FUNCTION public.set_buddy_discoverable(_on boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  UPDATE public.profiles SET buddy_discoverable = _on WHERE id = auth.uid();
  RETURN _on;
END $$;

CREATE OR REPLACE FUNCTION public.my_buddy_discoverable() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT buddy_discoverable FROM public.profiles WHERE id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.find_study_buddies(_education text DEFAULT NULL, _sex text DEFAULT NULL, _focusing_only boolean DEFAULT false, _limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, education text, age text, sex text, week_minutes bigint, focusing boolean, requested boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, p.avatar_url, NULLIF(trim(p.education), ''), NULLIF(trim(p.age), ''), NULLIF(trim(p.sex), ''),
    COALESCE((SELECT sum(f.duration_minutes) FROM public.focus_sessions f
              WHERE f.user_id = p.id AND f.status = 'completed' AND f.created_at >= now() - interval '7 days'), 0)::bigint AS wm,
    EXISTS (SELECT 1 FROM public.active_sessions a WHERE a.user_id = p.id AND a.status = 'active'),
    EXISTS (SELECT 1 FROM public.buddy_requests r WHERE r.from_id = uid AND r.to_id = p.id AND r.status = 'pending')
  FROM public.profiles p
  WHERE p.buddy_discoverable AND p.id <> uid
    AND public.current_buddy_id(p.id) IS NULL
    AND (_education IS NULL OR trim(_education) = '' OR regexp_replace(lower(COALESCE(p.education,'')), '[^a-z0-9]', '', 'g') LIKE '%' || regexp_replace(lower(_education), '[^a-z0-9]', '', 'g') || '%')
    AND (_sex IS NULL OR _sex = '' OR lower(p.sex) = lower(_sex))
    AND (NOT _focusing_only OR EXISTS (SELECT 1 FROM public.active_sessions a WHERE a.user_id = p.id AND a.status = 'active'))
  ORDER BY 8 DESC, 7 DESC
  LIMIT LEAST(GREATEST(_limit, 1), 50);
END $$;

CREATE OR REPLACE FUNCTION public.send_buddy_request(_to uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF _to = uid THEN RAISE EXCEPTION 'You cannot be your own study buddy.'; END IF;
  IF public.current_buddy_id(uid) IS NOT NULL THEN RAISE EXCEPTION 'You already have a study buddy.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _to AND buddy_discoverable) OR public.current_buddy_id(_to) IS NOT NULL THEN
    RAISE EXCEPTION 'This student is no longer looking for a buddy.';
  END IF;
  IF (SELECT count(*) FROM public.buddy_requests WHERE from_id = uid AND created_at > now() - interval '1 day') >= 15 THEN
    RAISE EXCEPTION 'You have sent enough requests today. Try again tomorrow.';
  END IF;
  INSERT INTO public.buddy_requests (from_id, to_id) VALUES (uid, _to) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.my_buddy_requests()
RETURNS TABLE(id uuid, from_id uuid, display_name text, avatar_url text, education text, week_minutes bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.from_id, p.display_name, p.avatar_url, NULLIF(trim(p.education), ''),
    COALESCE((SELECT sum(f.duration_minutes) FROM public.focus_sessions f
              WHERE f.user_id = p.id AND f.status = 'completed' AND f.created_at >= now() - interval '7 days'), 0)::bigint,
    r.created_at
  FROM public.buddy_requests r JOIN public.profiles p ON p.id = r.from_id
  WHERE r.to_id = auth.uid() AND r.status = 'pending'
  ORDER BY r.created_at DESC LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.respond_buddy_request(_id uuid, _accept boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.buddy_requests; c text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO r FROM public.buddy_requests WHERE buddy_requests.id = _id AND to_id = uid AND status = 'pending' FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'This request is no longer available.'; END IF;
  IF NOT _accept THEN
    UPDATE public.buddy_requests SET status = 'declined', responded_at = now() WHERE buddy_requests.id = r.id;
    RETURN false;
  END IF;
  IF public.current_buddy_id(uid) IS NOT NULL OR public.current_buddy_id(r.from_id) IS NOT NULL THEN
    UPDATE public.buddy_requests SET status = 'expired', responded_at = now() WHERE buddy_requests.id = r.id;
    RAISE EXCEPTION 'One of you already has a study buddy.';
  END IF;
  LOOP
    c := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 6));
    EXIT WHEN length(c) = 6 AND NOT EXISTS (SELECT 1 FROM public.study_buddies WHERE invite_code = c);
  END LOOP;
  UPDATE public.study_buddies SET status = 'removed' WHERE status = 'pending' AND inviter_id IN (uid, r.from_id);
  INSERT INTO public.study_buddies (inviter_id, invitee_id, invite_code, status, connected_at) VALUES (r.from_id, uid, c, 'active', now());
  UPDATE public.buddy_requests SET status = 'accepted', responded_at = now() WHERE buddy_requests.id = r.id;
  UPDATE public.buddy_requests SET status = 'expired', responded_at = now()
   WHERE status = 'pending' AND (from_id IN (uid, r.from_id) OR to_id IN (uid, r.from_id));
  RETURN true;
END $$;

-- Unguessable per-pair room for the study cam, only for the two buddies.
CREATE OR REPLACE FUNCTION public.buddy_cam_room() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'buddy-cam-' || md5(b.id::text || b.invite_code || b.created_at::text)
  FROM public.study_buddies b
  WHERE b.status = 'active' AND auth.uid() IS NOT NULL AND (b.inviter_id = auth.uid() OR b.invitee_id = auth.uid())
  ORDER BY b.connected_at DESC LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.set_buddy_discoverable(boolean), public.my_buddy_discoverable(), public.find_study_buddies(text, text, boolean, integer),
  public.send_buddy_request(uuid), public.my_buddy_requests(), public.respond_buddy_request(uuid, boolean), public.buddy_cam_room() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_buddy_discoverable(boolean), public.my_buddy_discoverable(), public.find_study_buddies(text, text, boolean, integer),
  public.send_buddy_request(uuid), public.my_buddy_requests(), public.respond_buddy_request(uuid, boolean), public.buddy_cam_room() TO authenticated;