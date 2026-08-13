-- ADR-005: Direct multimodal eval — evaluation_pages, gemini_batch_jobs, simplified script statuses.

-- Session mode (bulk class upload vs live single-student).
ALTER TABLE public.evaluation_batches
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'batch'
  CHECK (mode IN ('batch', 'live'));

-- Per-page storage with index payload (replaces page_order-only model for new uploads).
CREATE TABLE IF NOT EXISTS public.evaluation_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.evaluation_batches(id) ON DELETE CASCADE,
  script_id UUID REFERENCES public.evaluated_scripts(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  upload_index INT NOT NULL,
  content_hash TEXT NOT NULL,
  admission_number TEXT,
  admission_confidence NUMERIC,
  page_number INT,
  total_pages INT,
  questions_found JSONB NOT NULL DEFAULT '[]'::jsonb,
  index_model_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_pages_batch_id
  ON public.evaluation_pages (batch_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_pages_script_id
  ON public.evaluation_pages (script_id)
  WHERE script_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_pages_batch_content_hash
  ON public.evaluation_pages (batch_id, content_hash);

-- Gemini Batch API job tracking.
CREATE TABLE IF NOT EXISTS public.gemini_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.evaluation_batches(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('index', 'evaluate')),
  provider_batch_name TEXT,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'submitted', 'running', 'completed', 'failed', 'cancelled')),
  attempt_count INT NOT NULL DEFAULT 0,
  page_count INT NOT NULL DEFAULT 0,
  script_count INT NOT NULL DEFAULT 0,
  error TEXT,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gemini_batch_jobs_batch_id
  ON public.gemini_batch_jobs (batch_id);
CREATE INDEX IF NOT EXISTS idx_gemini_batch_jobs_state
  ON public.gemini_batch_jobs (state)
  WHERE state IN ('submitted', 'running');

-- Simplified script statuses (ADR-005).
ALTER TABLE public.evaluated_scripts
  DROP CONSTRAINT IF EXISTS evaluated_scripts_status_check;

ALTER TABLE public.evaluated_scripts
  ADD CONSTRAINT evaluated_scripts_status_check
  CHECK (
    status IN (
      'uploaded',
      'indexing',
      'identity_amber',
      'evaluating',
      'ready',
      'signed_off',
      'failed',
      'unmatched',
      -- legacy values kept for migration window
      'pending',
      'parsing',
      'identity_cleared',
      'queued_draft',
      'drafting',
      'drafted'
    )
  );

-- Rich question payload from direct multimodal evaluate.
ALTER TABLE public.question_evaluations
  ADD COLUMN IF NOT EXISTS student_work JSONB,
  ADD COLUMN IF NOT EXISTS correct_reference JSONB,
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS page_number INT,
  ADD COLUMN IF NOT EXISTS vertical_bounds JSONB,
  ADD COLUMN IF NOT EXISTS model_id TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS attention_status TEXT
    CHECK (attention_status IS NULL OR attention_status IN ('CORRECT', 'ATTENTION_NEEDED'));

-- Drop ADR-004 orchestration tables.
DROP TABLE IF EXISTS public.evaluation_jobs CASCADE;
DROP TABLE IF EXISTS public.page_parses CASCADE;
DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(INT);
DROP FUNCTION IF EXISTS public.requeue_stuck_evaluation_jobs(INT);

ALTER TABLE public.evaluation_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage evaluation pages of their batches"
  ON public.evaluation_pages FOR ALL
  USING (
    batch_id IN (
      SELECT eb.id FROM public.evaluation_batches eb
      JOIN public.classes c ON c.id = eb.class_id
      WHERE c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    batch_id IN (
      SELECT eb.id FROM public.evaluation_batches eb
      JOIN public.classes c ON c.id = eb.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers manage gemini batch jobs of their batches"
  ON public.gemini_batch_jobs FOR ALL
  USING (
    batch_id IN (
      SELECT eb.id FROM public.evaluation_batches eb
      JOIN public.classes c ON c.id = eb.class_id
      WHERE c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    batch_id IN (
      SELECT eb.id FROM public.evaluation_batches eb
      JOIN public.classes c ON c.id = eb.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Realtime on scripts for processing dots.
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluated_scripts;
