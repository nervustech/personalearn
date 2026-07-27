-- PSL-95: at most one open evaluation batch per assessment.
-- Normalize any illegal batch status "drafted" (script status leaked) → in_review.
UPDATE public.evaluation_batches
SET status = 'in_review'
WHERE status = 'drafted';

-- Keep the newest open batch per assessment; delete older open duplicates.
DELETE FROM public.evaluation_batches eb
WHERE eb.assessment_id IS NOT NULL
  AND eb.status IS DISTINCT FROM 'signed_off'
  AND eb.id NOT IN (
    SELECT DISTINCT ON (assessment_id) id
    FROM public.evaluation_batches
    WHERE assessment_id IS NOT NULL
      AND status IS DISTINCT FROM 'signed_off'
    ORDER BY assessment_id, created_at DESC
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_batches_one_open_per_assessment
  ON public.evaluation_batches (assessment_id)
  WHERE assessment_id IS NOT NULL
    AND status IS DISTINCT FROM 'signed_off';
