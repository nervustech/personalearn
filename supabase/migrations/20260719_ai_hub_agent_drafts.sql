-- PSL-80 / PSL-83: AI Hub draft persistence + teaching_aid resource type
-- PSL-81: admission uniqueness within a class

-- Expand resources.resource_type for non-gradable teaching aids
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_resource_type_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_resource_type_check
  CHECK (
    resource_type IS NULL
    OR resource_type IN (
      'scheme_of_work',
      'assignment',
      'lesson_notes',
      'marking_scheme',
      'quiz',
      'examination',
      'other',
      'teaching_aid'
    )
  );

-- Ephemeral server-side drafts for generate → confirm → save fidelity
CREATE TABLE public.ai_hub_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image')),
    title TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    content_text TEXT,
    storage_path TEXT,
    mime_type TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'saved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_hub_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage AI Hub drafts for their classes"
  ON public.ai_hub_drafts
  FOR ALL
  USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
    AND teacher_id = auth.uid()
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
    AND teacher_id = auth.uid()
  );

CREATE INDEX idx_ai_hub_drafts_class_created
  ON public.ai_hub_drafts(class_id, created_at DESC);

CREATE INDEX idx_ai_hub_drafts_teacher_status
  ON public.ai_hub_drafts(teacher_id, status);

-- Admission numbers unique per class when present (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_admission_unique
  ON public.students (class_id, lower(btrim(admission_number)))
  WHERE admission_number IS NOT NULL AND btrim(admission_number) <> '';
