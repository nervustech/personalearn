-- PSL-44: Evaluation batches schema + assessments.resource_id + student_submissions storage RLS.

-- Link class assessments to library resources (gradable save / eval start).
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_resource_id_unique
  ON public.assessments(resource_id)
  WHERE resource_id IS NOT NULL;

-- Evaluation pipeline tables
CREATE TABLE IF NOT EXISTS public.evaluation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
    marking_scheme_resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'in_review', 'signed_off')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluated_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.evaluation_batches(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    read_admission_number TEXT,
    match_confidence TEXT CHECK (match_confidence IN ('high', 'low')),
    page_order JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'identity_amber', 'identity_cleared', 'drafted', 'signed_off')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.question_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES public.evaluated_scripts(id) ON DELETE CASCADE,
    question_number TEXT NOT NULL,
    awarded NUMERIC,
    max NUMERIC,
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'ai_draft'
      CHECK (status IN ('ai_draft', 'ai_estimate', 'teacher_edited', 'reevaluated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_batches_class_id
  ON public.evaluation_batches(class_id);
CREATE INDEX IF NOT EXISTS idx_evaluated_scripts_batch_id
  ON public.evaluated_scripts(batch_id);
CREATE INDEX IF NOT EXISTS idx_question_evaluations_script_id
  ON public.question_evaluations(script_id);

ALTER TABLE public.evaluation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluated_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage evaluation batches of their classes"
  ON public.evaluation_batches FOR ALL
  USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers manage evaluated scripts in their batches"
  ON public.evaluated_scripts FOR ALL
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

CREATE POLICY "Teachers manage question evaluations in their scripts"
  ON public.question_evaluations FOR ALL
  USING (
    script_id IN (
      SELECT es.id FROM public.evaluated_scripts es
      JOIN public.evaluation_batches eb ON eb.id = es.batch_id
      JOIN public.classes c ON c.id = eb.class_id
      WHERE c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    script_id IN (
      SELECT es.id FROM public.evaluated_scripts es
      JOIN public.evaluation_batches eb ON eb.id = es.batch_id
      JOIN public.classes c ON c.id = eb.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- student_submissions storage bucket RLS (path: classId/batchId/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('student_submissions', 'student_submissions', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Teachers read own class submission files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student_submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers upload own class submission files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student_submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers update own class submission files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student_submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'student_submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers delete own class submission files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student_submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);
