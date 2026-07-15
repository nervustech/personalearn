-- PSL-52: structured comparison fields for teacher review workspace
ALTER TABLE public.question_evaluations
  ADD COLUMN IF NOT EXISTS student_answer TEXT,
  ADD COLUMN IF NOT EXISTS expected_answer TEXT;
