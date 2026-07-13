-- PSL-47 follow-up: unique competency row per student/class/strand for idempotent sign-off.
CREATE UNIQUE INDEX IF NOT EXISTS idx_competency_progress_student_class_strand
  ON public.competency_progress (student_id, class_id, strand);
