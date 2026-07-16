-- Backfill: assessments for gradable resources saved before AC-5.16 publish bridge.
INSERT INTO public.assessments (class_id, title, description, type, resource_id)
SELECT
  r.class_id,
  r.title,
  NULL,
  CASE r.resource_type
    WHEN 'quiz' THEN 'formative'
    WHEN 'examination' THEN 'summative'
    ELSE 'written'
  END,
  r.id
FROM public.resources r
LEFT JOIN public.assessments a ON a.resource_id = r.id
WHERE r.resource_type IN ('assignment', 'quiz', 'examination')
  AND a.id IS NULL;
