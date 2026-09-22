DROP POLICY "Anyone can submit pending student reviews" ON public.student_reviews;

CREATE POLICY "Anyone can submit pending student reviews"
ON public.student_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND public_at IS NULL
  AND (submitted_by IS NULL OR submitted_by = auth.uid())
);