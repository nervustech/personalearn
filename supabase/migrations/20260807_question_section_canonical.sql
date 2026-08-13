-- Section-aware question identity (A.1 vs B.1; restart without headers).
ALTER TABLE public.question_evaluations
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS canonical_key TEXT;

-- Backfill unique keys for existing rows (bare question_number).
UPDATE public.question_evaluations
SET canonical_key = question_number
WHERE canonical_key IS NULL OR btrim(canonical_key) = '';

ALTER TABLE public.question_evaluations
  ALTER COLUMN canonical_key SET NOT NULL;

-- Uniqueness moves from printed number → canonical identity.
DROP INDEX IF EXISTS idx_question_evaluations_script_question;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_evaluations_script_canonical
  ON public.question_evaluations (script_id, canonical_key);
