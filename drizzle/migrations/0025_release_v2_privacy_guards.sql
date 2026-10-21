CREATE TABLE public.buddy_cam_signals (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sender_id uuid NOT NULL, recipient_id uuid NOT NULL, room text NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.buddy_cam_signals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.buddy_cam_signals_id_seq TO service_role;
ALTER TABLE public.buddy_cam_signals ENABLE ROW LEVEL SECURITY;
CREATE INDEX buddy_cam_signals_recipient ON public.buddy_cam_signals(recipient_id, id);
CREATE OR REPLACE FUNCTION public.send_buddy_cam_signal(_room text, _payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bid uuid := public.current_buddy_id(auth.uid());
BEGIN
 IF uid IS NULL OR bid IS NULL OR _room IS DISTINCT FROM public.buddy_cam_room() THEN RAISE EXCEPTION 'No active buddy room'; END IF;
 IF pg_column_size(_payload) > 32768 OR _payload->>'kind' NOT IN ('hello','bye','sdp','ice') THEN RAISE EXCEPTION 'Invalid signal'; END IF;
 IF _payload->>'from' IS DISTINCT FROM uid::text OR (_payload ? 'to' AND _payload->>'to' IS DISTINCT FROM bid::text) THEN RAISE EXCEPTION 'Invalid sender'; END IF;
 DELETE FROM public.buddy_cam_signals WHERE created_at < now() - interval '2 minutes';
 INSERT INTO public.buddy_cam_signals(sender_id,recipient_id,room,payload) VALUES(uid,bid,_room,_payload);
END $$;
CREATE OR REPLACE FUNCTION public.read_buddy_cam_signals(_room text, _after bigint DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); result jsonb;
BEGIN
 IF uid IS NULL OR public.current_buddy_id(uid) IS NULL OR _room IS DISTINCT FROM public.buddy_cam_room() THEN RAISE EXCEPTION 'No active buddy room'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'payload',s.payload) ORDER BY s.id),'[]'::jsonb) INTO result
 FROM (SELECT id,payload FROM public.buddy_cam_signals WHERE recipient_id=uid AND sender_id=public.current_buddy_id(uid) AND room=_room AND id>_after AND created_at>now()-interval '30 seconds' ORDER BY id LIMIT 100) s;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.send_buddy_cam_signal(text,jsonb),public.read_buddy_cam_signals(text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_buddy_cam_signal(text,jsonb),public.read_buddy_cam_signals(text,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.delete_account_app_data(_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; other_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('delete_account:' || _user_id::text));
 FOR r IN SELECT * FROM public.referrals WHERE referrer_id=_user_id OR referred_id=_user_id FOR UPDATE LOOP
  other_id := CASE WHEN r.referrer_id=_user_id THEN r.referred_id ELSE r.referrer_id END;
  IF other_id IS NOT NULL AND other_id<>_user_id AND r.bonus_amount>0 THEN
   INSERT INTO public.coin_adjustments(user_id,amount,reason) VALUES(other_id,r.bonus_amount,'referral_bonus_kept:'||r.id::text);
  END IF;
 END LOOP;
 DELETE FROM public.referrals WHERE referrer_id=_user_id OR referred_id=_user_id;
 DELETE FROM public.buddy_cam_signals WHERE sender_id=_user_id OR recipient_id=_user_id;
 DELETE FROM public.buddy_events WHERE user_id=_user_id OR recipient_id=_user_id;
 DELETE FROM public.buddy_requests WHERE from_id=_user_id OR to_id=_user_id;
 DELETE FROM public.study_buddies WHERE inviter_id=_user_id OR invitee_id=_user_id;
 DELETE FROM public.active_sessions WHERE user_id=_user_id;
 DELETE FROM public.focus_sessions WHERE user_id=_user_id;
 DELETE FROM public.session_claims_archive WHERE user_id=_user_id;
 DELETE FROM public.focus_sessions_duplicates_archive WHERE user_id=_user_id;
 DELETE FROM public.coin_adjustments WHERE user_id=_user_id;
 UPDATE public.profiles SET referred_by=NULL WHERE referred_by=_user_id;
 DELETE FROM public.study_plans WHERE user_id=_user_id;
 DELETE FROM public.todos WHERE user_id=_user_id;
 DELETE FROM public.academic_subjects WHERE user_id=_user_id;
 DELETE FROM public.user_settings WHERE user_id=_user_id;
 DELETE FROM public.group_members WHERE user_id=_user_id;
 DELETE FROM public.study_groups WHERE creator_id=_user_id;
 DELETE FROM public.student_reviews WHERE submitted_by=_user_id;
 DELETE FROM public.wallets WHERE user_id=_user_id;
 DELETE FROM public.leaderboard_totals WHERE user_id=_user_id;
 DELETE FROM public.user_roles WHERE user_id=_user_id;
 DELETE FROM public.profiles WHERE id=_user_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_account_app_data(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_app_data(uuid) TO service_role;