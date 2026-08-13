-- ADR-005 poll/rollup writes evaluation_batches.status = 'processing'
-- while index/evaluate jobs run. The CHECK originally shipped as
-- draft | in_review | signed_off (20260709). Keep this in the committed
-- chain so prod/dev stay aligned without the superseded ADR-004 jobs tables.

ALTER TABLE public.evaluation_batches
  DROP CONSTRAINT IF EXISTS evaluation_batches_status_check;

ALTER TABLE public.evaluation_batches
  ADD CONSTRAINT evaluation_batches_status_check
  CHECK (status IN ('draft', 'processing', 'in_review', 'signed_off'));
