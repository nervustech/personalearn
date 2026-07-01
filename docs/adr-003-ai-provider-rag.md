# ADR-003 — AI provider + RAG

**Status:** Accepted (Sprint 2)  
**Related:** PSL-37, PSL-6, PSL-9

## Context

PersonaLearn needs embeddings for RAG and an LLM for co-pilot answers. Sprint 0 schema assumed OpenAI 1536-dim vectors.

## Decision

| Layer | Provider | Integration |
|-------|----------|-------------|
| Embeddings | Voyage AI `voyage-3.5` @ 1024 dims | REST API in `src/lib/ai/embeddings.ts` |
| Chat (Sprint 2 interim) | DeepSeek default via `CHAT_PROVIDER` | Vercel AI SDK `@ai-sdk/deepseek` |
| Chat (Sprint 3 TBD) | Grok vs DeepSeek primary | `@ai-sdk/xai` wired; product decision deferred |

**In-app SDK:** Vercel AI SDK (`ai` package). Not Cursor SDK (developer automation only).

## Consequences

- Migration `20260701_voyage_embedding_dims.sql` resizes pgvector to 1024.
- Env: `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `CHAT_PROVIDER`.

## Mirror in Confluence

Duplicate this page under PLEARN → Architecture when publishing sprint docs.
