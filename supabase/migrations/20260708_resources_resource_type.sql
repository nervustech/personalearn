-- PSL-27: resource_type for agent-saved and classified class resources

ALTER TABLE public.resources
  ADD COLUMN resource_type TEXT
  CHECK (
    resource_type IS NULL
    OR resource_type IN (
      'scheme_of_work',
      'assignment',
      'lesson_notes',
      'marking_scheme',
      'quiz',
      'examination',
      'other'
    )
  );
