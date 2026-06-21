-- PersonaLearn initial schema (Phase 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. users (Teachers)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. classes
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 1 AND 9),
    subject TEXT NOT NULL,
    term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
    academic_year TEXT NOT NULL,
    section TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. schemes_of_work
CREATE TABLE public.schemes_of_work (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    raw_content JSONB NOT NULL,
    ai_generated BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. resources
CREATE TABLE public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    raw_content JSONB NOT NULL,
    ai_generated BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. resource_chunks
CREATE TABLE public.resource_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB DEFAULT '{}'
);

-- 6. assessments
CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    linked_strand TEXT,
    linked_sub_strand TEXT,
    type TEXT CHECK (type IN ('practical', 'written', 'formative', 'summative')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. students
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    admission_number TEXT,
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Male', 'Female')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. student_submissions
CREATE TABLE public.student_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    content TEXT,
    file_url TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    ai_feedback TEXT,
    teacher_feedback TEXT,
    competency_flags JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. competency_progress
CREATE TABLE public.competency_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    strand TEXT NOT NULL,
    sub_strand TEXT,
    competency_code TEXT,
    status TEXT NOT NULL CHECK (status IN ('mastered', 'developing', 'not_yet')),
    last_evidence_at TIMESTAMPTZ,
    evidence_count INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Teachers can manage their own classes" ON public.classes
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can manage schemes of their classes" ON public.schemes_of_work
  FOR ALL USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can manage resources of their classes" ON public.resources
  FOR ALL USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can manage resource chunks of their classes" ON public.resource_chunks
  FOR ALL USING (
    resource_id IN (
      SELECT id FROM public.resources
      WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can manage assessments of their classes" ON public.assessments
  FOR ALL USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can manage students in their classes" ON public.students
  FOR ALL USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can manage submissions in their classes" ON public.student_submissions
  FOR ALL USING (
    assessment_id IN (
      SELECT id FROM public.assessments
      WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can manage competency progress in their classes" ON public.competency_progress
  FOR ALL USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX idx_schemes_class_id ON public.schemes_of_work(class_id);
CREATE INDEX idx_resources_class_id ON public.resources(class_id);
CREATE INDEX idx_assessments_class_id ON public.assessments(class_id);
CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_submissions_assessment_id ON public.student_submissions(assessment_id);
CREATE INDEX idx_competency_student_class ON public.competency_progress(student_id, class_id);
CREATE INDEX idx_resource_chunks_embedding ON public.resource_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Auth user onboarding trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RAG similarity search helper
CREATE OR REPLACE FUNCTION public.match_resource_chunks(
  query_embedding VECTOR(1536),
  match_class_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  resource_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rc.id,
    rc.resource_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM public.resource_chunks rc
  JOIN public.resources r ON r.id = rc.resource_id
  WHERE r.class_id = match_class_id
    AND rc.embedding IS NOT NULL
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Storage buckets (run in Supabase dashboard if SQL insert fails)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('resources', 'resources', false),
  ('student_submissions', 'student_submissions', false)
ON CONFLICT (id) DO NOTHING;
