CREATE UNIQUE INDEX IF NOT EXISTS coin_adjustments_first_completion_once ON public.coin_adjustments(user_id) WHERE reason = 'first_completion_bonus';
CREATE OR REPLACE FUNCTION public.award_first_completion_bonus() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.focus_sessions WHERE user_id = NEW.user_id AND status = 'completed' AND id <> NEW.id) THEN RETURN NEW; END IF;
  INSERT INTO public.coin_adjustments(user_id, amount, reason) VALUES (NEW.user_id, 50, 'first_completion_bonus') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.award_first_completion_bonus() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER first_completion_starter_bonus AFTER INSERT ON public.focus_sessions FOR EACH ROW EXECUTE FUNCTION public.award_first_completion_bonus();