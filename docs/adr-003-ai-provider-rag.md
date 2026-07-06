# ADR-003 — AI provider + RAG

**Status:** Accepted (Sprint 2; Sprint 3 chat provider locked 2026-07-06)  
**Related:** PSL-37, PSL-6, PSL-9, PSL-42, PSL-7, PSL-27

## Context

PersonaLearn needs embeddings for RAG and an LLM for co-pilot answers. Sprint 0 schema assumed OpenAI 1536-dim vectors.

## Decision

| Layer | Provider | Integration |
|-------|----------|-------------|
| Embeddings | Voyage AI `voyage-3.5` @ 1024 dims | REST API in `src/lib/ai/embeddings.ts` |
| Chat (Sprint 2–3) | DeepSeek primary via `CHAT_PROVIDER=deepseek` | Vercel AI SDK `@ai-sdk/deepseek` |
| Vision (Sprint 5+) | Grok via `CHAT_PROVIDER=xai` | `@ai-sdk/xai` for handwriting reads on scanned scripts |

**In-app SDK:** Vercel AI SDK (`ai` package). Not Cursor SDK (developer automation only).

## Consequences

- Migration `20260701_voyage_embedding_dims.sql` resizes pgvector to 1024.
- Env: `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `CHAT_PROVIDER`.

## Mirror in Confluence

Duplicate this page under PLEARN → Architecture when publishing sprint docs.
