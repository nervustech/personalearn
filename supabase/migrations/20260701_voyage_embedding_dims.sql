-- PSL-37: Voyage voyage-3.5 embeddings use 1024 dimensions (not OpenAI 1536).

DROP INDEX IF EXISTS idx_resource_chunks_embedding;

ALTER TABLE public.resource_chunks
  ALTER COLUMN embedding TYPE VECTOR(1024)
  USING embedding::text::vector(1024);

CREATE INDEX idx_resource_chunks_embedding ON public.resource_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_resource_chunks(
  query_embedding VECTOR(1024),
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
