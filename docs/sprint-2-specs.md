# Sprint 2 specs (Confluence mirror)

Publish these under [PLEARN Specs](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/5767169/Specs) when Confluence write access is available.

## PSL-37 — Wire AI provider

- Voyage `voyage-3.5` embeddings + Vercel AI SDK chat (`getChatModel`)
- pgvector 1024-dim migration
- Vitest smoke tests

## PSL-6 — TXT upload + RAG ingest

- Storage RLS on `resources` bucket
- Chunk ~1000 chars / 200 overlap
- `/api/resources/ingest` + class upload UI

## PSL-9 — Co-pilot Q&A

- `/api/query-resources` with citations
- AI Hub co-pilot panel + empty state

See [adr-003-ai-provider-rag.md](./adr-003-ai-provider-rag.md).
