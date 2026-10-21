CREATE TABLE public.study_buddies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL,
  invitee_id uuid,
  invite_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  connected_at timestamptz
);
CREATE INDEX study_buddies_inviter_idx ON public.study_buddies(inviter_id, status);
CREATE INDEX study_buddies_invitee_idx ON public.study_buddies(invitee_id, status);
GRANT SELECT ON public.study_buddies TO authenticated;
GRANT ALL ON public.study_buddies TO service_role;
ALTER TABLE public.study_buddies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buddies read own pairs" ON public.study_buddies FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE TABLE public.buddy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('started','completed','failed','nudge')),
  goal text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  source_id text,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buddy_events_once ON public.buddy_events(recipient_id, event_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX buddy_events_recipient_idx ON public.buddy_events(recipient_id, created_at DESC);
GRANT SELECT ON public.buddy_events TO authenticated;
GRANT ALL ON public.buddy_events TO service_role;
ALTER TABLE public.buddy_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients read buddy events" ON public.buddy_events FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.current_buddy_id(_user_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN inviter_id = _user_id THEN invitee_id ELSE inviter_id END
  FROM public.study_buddies
  WHERE status = 'active' AND (inviter_id = _user_id OR invitee_id = _user_id)
  ORDER BY connected_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.create_buddy_invite() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c text; existing text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF public.current_buddy_id(uid) IS NOT NULL THEN RAISE EXCEPTION 'You already have a study buddy.'; END IF;
  SELECT invite_code INTO existing FROM public.study_buddies WHERE inviter_id = uid AND status = 'pending' LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  LOOP
    c := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 6));
    EXIT WHEN length(c) = 6 AND NOT EXISTS (SELECT 1 FROM public.study_buddies WHERE invite_code = c);
  END LOOP;
  INSERT INTO public.study_buddies (inviter_id, invite_code) VALUES (uid, c);
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.buddy_invite_preview(_code text)
RETURNS TABLE(inviter_name text, inviter_avatar text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.display_name, p.avatar_url, b.status
  FROM public.study_buddies b JOIN public.profiles p ON p.id = b.inviter_id
  WHERE b.invite_code = upper(trim(_code)) AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.accept_buddy_invite(_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.study_buddies;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  SELECT * INTO b FROM public.study_buddies WHERE invite_code = upper(trim(_code)) FOR UPDATE;
  IF b.id IS NULL OR b.status <> 'pending' THEN RAISE EXCEPTION 'This invite is no longer valid.'; END IF;
  IF b.inviter_id = uid THEN RAISE EXCEPTION 'You cannot be your own study buddy.'; END IF;
  IF public.current_buddy_id(uid) IS NOT NULL OR public.current_buddy_id(b.inviter_id) IS NOT NULL THEN
    RAISE EXCEPTION 'One of you already has a study buddy.';
  END IF;
  UPDATE public.study_buddies SET invitee_id = uid, status = 'active', connected_at = now() WHERE id = b.id;
  UPDATE public.study_buddies SET status = 'removed' WHERE inviter_id = uid AND status = 'pending';
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.remove_study_buddy() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  UPDATE public.study_buddies SET status = 'removed'
   WHERE status IN ('active','pending') AND (inviter_id = uid OR invitee_id = uid);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.my_study_buddy()
RETURNS TABLE(buddy_id uuid, display_name text, avatar_url text, focusing boolean, goal text,
              ends_at timestamptz, today_minutes bigint, pending_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bid uuid; code text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  bid := public.current_buddy_id(uid);
  IF bid IS NULL THEN
    SELECT invite_code INTO code FROM public.study_buddies WHERE inviter_id = uid AND status = 'pending' LIMIT 1;
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false, NULL::text, NULL::timestamptz, 0::bigint, code;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT bid, p.display_name, p.avatar_url,
         (a.user_id IS NOT NULL AND a.status = 'active'),
         a.goal,
         a.started_at + make_interval(mins => a.duration_minutes),
         COALESCE((SELECT sum(f.duration_minutes) FROM public.focus_sessions f
                    WHERE f.user_id = bid AND f.status = 'completed'
                      AND f.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'), 0)::bigint,
         NULL::text
  FROM public.profiles p
  LEFT JOIN public.active_sessions a ON a.user_id = bid
  WHERE p.id = bid;
END $$;

CREATE OR REPLACE FUNCTION public.nudge_study_buddy() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  bid := public.current_buddy_id(uid);
  IF bid IS NULL THEN RAISE EXCEPTION 'You do not have a study buddy yet.'; END IF;
  IF EXISTS (SELECT 1 FROM public.buddy_events WHERE user_id = uid AND event_type = 'nudge' AND created_at > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'You nudged recently. Try again in a few minutes.';
  END IF;
  INSERT INTO public.buddy_events (user_id, recipient_id, event_type) VALUES (uid, bid, 'nudge');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.mark_buddy_events_seen() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.buddy_events SET seen_at = now()
             WHERE recipient_id = auth.uid() AND seen_at IS NULL RETURNING 1)
  SELECT count(*)::int FROM u
$$;

CREATE OR REPLACE FUNCTION public.buddy_event_from_active() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bid uuid;
BEGIN
  bid := public.current_buddy_id(NEW.user_id);
  IF bid IS NOT NULL THEN
    INSERT INTO public.buddy_events (user_id, recipient_id, event_type, goal, duration_minutes, source_id)
    VALUES (NEW.user_id, bid, 'started', NEW.goal, NEW.duration_minutes, NEW.user_id::text || ':' || NEW.started_at::text)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
CREATE TRIGGER buddy_event_on_active_start AFTER INSERT ON public.active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.buddy_event_from_active();

CREATE OR REPLACE FUNCTION public.buddy_event_from_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bid uuid;
BEGIN
  IF NEW.status NOT IN ('completed','failed') THEN RETURN NULL; END IF;
  bid := public.current_buddy_id(NEW.user_id);
  IF bid IS NOT NULL THEN
    INSERT INTO public.buddy_events (user_id, recipient_id, event_type, goal, duration_minutes, coins, source_id)
    VALUES (NEW.user_id, bid, NEW.status, NEW.goal, NEW.duration_minutes, NEW.coins_earned, NEW.id::text)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
CREATE TRIGGER buddy_event_on_session AFTER INSERT ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.buddy_event_from_session();

GRANT EXECUTE ON FUNCTION public.create_buddy_invite(), public.buddy_invite_preview(text), public.accept_buddy_invite(text),
  public.remove_study_buddy(), public.my_study_buddy(), public.nudge_study_buddy(), public.mark_buddy_events_seen() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_buddy_id(uuid) FROM anon, authenticated, public;

-- Group pot: forfeits from members who fail/leave after start are split evenly among completers.
CREATE OR REPLACE FUNCTION public.group_pot_amount(_group_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(m.held_amount), 0)::int
  FROM public.group_members m JOIN public.study_groups g ON g.id = m.group_id
  WHERE m.group_id = _group_id AND m.status IN ('failed','left')
    AND g.started_at IS NOT NULL AND m.settled_at IS NOT NULL AND m.settled_at >= g.started_at
    AND m.held_amount > 0
$$;

CREATE OR REPLACE FUNCTION public.pay_group_pot_share(_group_id uuid, _user_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pot integer; finishers integer; share integer; tag text := 'group_pot:' || _group_id::text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.coin_adjustments WHERE user_id = _user_id AND reason = tag) THEN RETURN 0; END IF;
  pot := public.group_pot_amount(_group_id);
  IF pot <= 0 THEN RETURN 0; END IF;
  SELECT count(*) INTO finishers FROM public.group_members
   WHERE group_id = _group_id AND status IN ('completed','committed','joined');
  share := floor(pot::numeric / greatest(1, finishers))::int;
  IF share <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.coin_adjustments (user_id, amount, reason) VALUES (_user_id, share, tag);
  RETURN share;
END $$;
REVOKE EXECUTE ON FUNCTION public.pay_group_pot_share(uuid, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.group_pot_amount(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_expired_study_group(_user_id uuid, _group_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g public.study_groups; gm record; reward integer;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL OR g.status <> 'active' OR g.ends_at IS NULL OR now() < g.ends_at THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g.id AND user_id = _user_id) THEN RAISE EXCEPTION 'Not allowed.'; END IF;
  reward := 25 * floor(g.duration_minutes / 60.0)::int;
  FOR gm IN SELECT * FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined') AND settled_at IS NULL FOR UPDATE LOOP
    UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - gm.held_amount), coin_balance = coin_balance + reward WHERE user_id = gm.user_id;
    PERFORM public.pay_group_pot_share(g.id, gm.user_id);
    UPDATE public.group_members SET status = 'completed', settled_at = now() WHERE id = gm.id;
    INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned)
    VALUES (gm.user_id, g.goal, g.duration_minutes, g.commit_value, g.mode, 'completed', 0, reward);
  END LOOP;
  DELETE FROM public.active_sessions WHERE user_id IN (SELECT user_id FROM public.group_members WHERE group_id = g.id);
  UPDATE public.study_groups SET status = 'ended' WHERE id = g.id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_study_group_member(_user_id uuid, _group_id uuid, _status text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := _user_id; g public.study_groups; member public.group_members; final_status text; reward integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF _status NOT IN ('completed', 'failed', 'left') THEN RAISE EXCEPTION 'Invalid outcome.'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  SELECT * INTO member FROM public.group_members WHERE group_id = g.id AND user_id = uid FOR UPDATE;
  IF member.id IS NULL THEN RAISE EXCEPTION 'You are not a member of this group.'; END IF;
  IF member.settled_at IS NOT NULL THEN RETURN member.status; END IF;
  reward := 0;
  IF _status = 'completed' THEN
    IF g.ends_at IS NULL OR now() < g.ends_at THEN RAISE EXCEPTION 'The shared timer has not finished yet.'; END IF;
    reward := 25 * floor(g.duration_minutes / 60.0)::int;
    UPDATE public.wallets SET coins_reserved = greatest(0, coins_reserved - member.held_amount), coin_balance = coin_balance + reward WHERE user_id = uid;
    PERFORM public.pay_group_pot_share(g.id, uid);
    UPDATE public.group_members SET status = 'completed', settled_at = now() WHERE id = member.id;
    DELETE FROM public.active_sessions WHERE user_id = uid;
    final_status := 'completed';
  ELSE
    final_status := CASE WHEN _status = 'left' THEN 'left' ELSE 'failed' END;
    UPDATE public.wallets SET coin_balance = greatest(0, coin_balance - member.held_amount), coins_reserved = greatest(0, coins_reserved - member.held_amount) WHERE user_id = uid;
    UPDATE public.group_members SET status = final_status, left_at = now(), settled_at = now() WHERE id = member.id;
    DELETE FROM public.active_sessions WHERE user_id = uid;
  END IF;
  INSERT INTO public.focus_sessions (user_id, goal, duration_minutes, value, mode, status, coins_spent, coins_earned)
  VALUES (uid, g.goal, g.duration_minutes, g.commit_value, g.mode,
          CASE WHEN final_status = 'completed' THEN 'completed' ELSE 'failed' END,
          CASE WHEN final_status = 'completed' THEN 0 ELSE g.commit_value END, reward);
  IF _status = 'completed' AND NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g.id AND status IN ('committed', 'joined')) THEN UPDATE public.study_groups SET status = 'ended' WHERE id = g.id; END IF;
  RETURN final_status;
END;
$function$;