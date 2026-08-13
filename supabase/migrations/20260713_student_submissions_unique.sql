-- PSL-47: unique student submission per assessment for idempotent sign-off upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_submissions_assessment_student
  ON public.student_submissions (assessment_id, student_id);
