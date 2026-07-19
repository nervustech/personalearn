-- Epic F / ADR-004: eval pipeline rehaul — batch processing status + question bounding boxes.

-- Allow async in-flight + drafted batch statuses (keep in_review for existing rows).
ALTER TABLE public.evaluation_batches
  DROP CONSTRAINT IF EXISTS evaluation_batches_status_check;

ALTER TABLE public.evaluation_batches
  ADD CONSTRAINT evaluation_batches_status_check
  CHECK (status IN ('draft', 'processing', 'drafted', 'in_review', 'signed_off'));

-- Vision regions for review highlight + crop re-prompt (normalized 0–1000 box coords).
ALTER TABLE public.question_evaluations
  ADD COLUMN IF NOT EXISTS bounding_box JSONB;

COMMENT ON COLUMN public.question_evaluations.bounding_box IS
  'JSON array of { page, ymin, xmin, ymax, xmax } (0–1000 normalized); multi-page answers allowed.';
