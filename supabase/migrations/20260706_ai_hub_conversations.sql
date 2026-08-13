-- PSL-42: AI Hub conversation history

CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage conversations for their classes"
  ON public.conversations
  FOR ALL
  USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Teachers can manage messages for their conversations"
  ON public.conversation_messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT c.id
      FROM public.conversations c
      JOIN public.classes cl ON cl.id = c.class_id
      WHERE cl.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT c.id
      FROM public.conversations c
      JOIN public.classes cl ON cl.id = c.class_id
      WHERE cl.teacher_id = auth.uid()
    )
  );

CREATE INDEX idx_conversations_class_updated
  ON public.conversations(class_id, updated_at DESC);

CREATE INDEX idx_conversation_messages_conversation_created
  ON public.conversation_messages(conversation_id, created_at ASC);
