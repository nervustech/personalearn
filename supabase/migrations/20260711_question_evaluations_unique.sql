-- PSL-46: one evaluation row per question per script (safe re-draft upserts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_evaluations_script_question
  ON public.question_evaluations (script_id, question_number);
