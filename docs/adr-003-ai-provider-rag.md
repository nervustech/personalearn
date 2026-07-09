# ADR-003 — AI provider + RAG

**Status:** Accepted (Sprint 2; Sprint 3 chat provider locked 2026-07-06; vision provider updated 2026-07-08)  
**Related:** PSL-37, PSL-6, PSL-9, PSL-42, PSL-7, PSL-27, PSL-43, PSL-8 (Sprint 5 parent)

## Context

PersonaLearn needs embeddings for RAG, an LLM for co-pilot answers, and a vision model for document/image text extraction (Sprint 4+) and handwritten script reads (Sprint 5). Sprint 0 schema assumed OpenAI 1536-dim vectors. Early Phase 0 notes named Grok for vision; Grok API access is unavailable and third-party OCR benchmarks favour Gemini for handwriting at lower cost.

## Decision

| Layer | Provider | Integration |
|-------|----------|-------------|
| Embeddings | Voyage AI `voyage-3.5` @ 1024 dims | REST API in `src/lib/ai/embeddings.ts` |
| Chat (Sprint 2–3+) | DeepSeek primary via `CHAT_PROVIDER=deepseek` | Vercel AI SDK `@ai-sdk/deepseek` |
| Vision (Sprint 4+) | Google Gemini (tiered) | `@ai-sdk/google` — see tiering below |

### Vision tiering (Sprint 4 + 5)

| Tier | Model | Use |
|------|-------|-----|
| Default | `gemini-2.5-flash-lite` | Bulk page reads, image upload OCR (Sprint 4), admission/question reads (Sprint 5) |
| Standard | `gemini-2.5-flash` | Fallback when Lite confidence is low |
| Escalation | `gemini-2.5-pro` | Amber flags, conflicts, illegible handwriting (~10–20% of pages in Sprint 5) |

**Sprint 4 (PSL-43):** TXT via `file.text()`, PDF via `unpdf` (no vision API), JPEG/PNG via Gemini Flash.

**Sprint 5 (PSL-8 children):** All handwriting reads (admission numbers, question numbers, answers) go through the vision LLM tier stack — **not traditional OCR**. Teacher review queue remains the quality gate. Identity/grouping ticket must not open until Phase 0 below is recorded.

**Deprecated for vision:** Grok/xAI — no API access; not recommended for production OCR per 2026 benchmarks (hallucination risk). `XAI_API_KEY` / `CHAT_PROVIDER=xai` remain optional for chat experiments only, not the vision path.

**In-app SDK:** Vercel AI SDK (`ai` package). Not Cursor SDK (developer automation only).

## Consequences

- Migration `20260701_voyage_embedding_dims.sql` resizes pgvector to 1024.
- Env: `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL`, `DEEPSEEK_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CHAT_PROVIDER`.
- **Testing:** Gemini free tier is sufficient for local dev and QA (see Sprint 4 sign-off). Enable Cloud billing (paid tier) before production — Google does not use paid-tier prompts for model training.

### Sprint 5 Phase 0 — Vision benchmark (gate before identity ticket)

**Required before Ticket 2 (identity + grouping) opens:**

1. Collect **20–30 real Kenyan handwritten script page samples** (admission numbers + question numbers visible; mix of clear / messy / missing ID).
2. Run each page through the tier stack: `gemini-2.5-flash-lite` → escalate to `gemini-2.5-flash` on low confidence → `gemini-2.5-pro` for amber/conflict/illegible cases.
3. Record in this ADR (or a linked note under PLEARN Architecture):
   - Admission-number read accuracy per tier
   - Escalation rate (% pages needing Flash / Pro)
   - Chosen confidence thresholds for Lite→Flash and Flash→Pro
4. Sign-off: thresholds accepted before identity PR branch opens.

**Status:** Pending — run during Ticket 1 / before Ticket 2 kickoff.

## Mirror in Confluence

Duplicate this page under PLEARN → Architecture when publishing sprint docs.
