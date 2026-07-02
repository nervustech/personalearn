# Retrospective: Sprint 2 (draft)

## Sprint goal

RAG vertical slice — upload TXT, ingest with Voyage embeddings, co-pilot Q&A.

## Keep doing

- One ticket → one branch → one PR
- Tests colocated with features
- Provider abstraction (`getChatModel`, Voyage embed module)

## Start doing

- Publish Confluence specs/release notes from `docs/sprint-2-*.md` mirrors
- Run migrations on dev Supabase before preview QA

## Action items

- [ ] Apply pgvector + storage RLS migrations on dev Supabase
- [ ] Configure Voyage + DeepSeek keys on Vercel preview
- [ ] Open PRs: PSL-37 → PSL-6 → PSL-9 (sequential merge)
- [ ] Decide Grok vs DeepSeek primary in Sprint 3
