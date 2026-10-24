DROP POLICY IF EXISTS "Active buddies read buddy events" ON public.buddy_events;
CREATE POLICY "Active buddies read buddy events" ON public.buddy_events
FOR SELECT TO authenticated
USING (
  (auth.uid() = recipient_id OR auth.uid() = user_id)
  AND EXISTS (
    SELECT 1 FROM public.study_buddies b
    WHERE b.status = 'active'
      AND ((b.inviter_id = buddy_events.user_id AND b.invitee_id = buddy_events.recipient_id)
        OR (b.inviter_id = buddy_events.recipient_id AND b.invitee_id = buddy_events.user_id))
  )
);