# Sprint 2 — Release Notes

**Sprint goal:** Have the co-pilot capabilities set up (PSL-2 RAG vertical slice).

## Shipped (this branch stack)

| Jira | Summary | Key paths |
|------|---------|-----------|
| PSL-37 | AI provider wiring (Voyage embed + Vercel AI SDK chat) | `src/lib/ai/*`, `supabase/migrations/20260701_voyage_embedding_dims.sql` |
| PSL-6 | TXT upload + RAG ingest | `/api/resources/ingest`, `ResourceUploadCard` |
| PSL-9 | Co-pilot Q&A with citations | `/api/query-resources`, `CopilotPanel`, `/ai-hub` |

## Manual QA (Vercel preview)

1. Apply migrations `20260701` and `20260702` on dev Supabase.
2. Set env: `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL=voyage-3.5`, `DEEPSEEK_API_KEY`, `CHAT_PROVIDER=deepseek`.
3. Sign in → open a class → upload sample `.txt` scheme.
4. AI Hub → ask a question → verify answer cites the upload.

## Deferred to Sprint 3

PSL-7 lesson generation, PSL-8 multimodal feedback, Grok vs DeepSeek primary co-pilot decision.

## Mirror in Confluence

Publish under PLEARN → Releases when write access is available.
