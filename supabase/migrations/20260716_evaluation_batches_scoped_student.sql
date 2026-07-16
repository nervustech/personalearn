-- PSL-48: Optional N=1 scope on evaluation batches (roster student profile).

ALTER TABLE public.evaluation_batches
  ADD COLUMN IF NOT EXISTS scoped_student_id UUID
    REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evaluation_batches_scoped_student_id
  ON public.evaluation_batches(scoped_student_id)
  WHERE scoped_student_id IS NOT NULL;
