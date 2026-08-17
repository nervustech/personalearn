-- PSL-106: at most one inflight Gemini job per evaluation session + phase.
-- Sequential re-index / re-evaluate is allowed after the prior job completes
-- or fails (partial unique index only covers submitted | running).

CREATE UNIQUE INDEX IF NOT EXISTS idx_gemini_batch_jobs_one_inflight_per_phase
  ON public.gemini_batch_jobs (batch_id, phase)
  WHERE state IN ('submitted', 'running');
