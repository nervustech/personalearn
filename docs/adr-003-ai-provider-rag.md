# ADR-003 — AI provider + RAG

**Status:** Accepted (Sprint 2; Sprint 3 chat provider locked 2026-07-06; vision provider updated 2026-07-08; Sprint 5 Phase 0 deferred 2026-07-10)  
**Related:** PSL-37, PSL-6, PSL-9, PSL-42, PSL-7, PSL-27, PSL-43, PSL-8 (Sprint 5 parent), PSL-50 (Phase 0 deferral), PSL-45

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
| Default (Sprint 5 ship) | `gemini-2.5-flash-lite` | Admission/question reads (PSL-45+); preferred bulk path |
| Standard (deferred) | `gemini-2.5-flash` | Optional fallback if Lite accuracy fails in pilot / real scripts |
| Escalation (deferred) | `gemini-2.5-pro` | Optional for amber/conflict/illegible once evidence warrants |

**Sprint 4 (PSL-43):** TXT via `file.text()`, PDF via `unpdf` (no vision API), JPEG/PNG via Gemini Flash.

**Sprint 5 (PSL-8 children):** All handwriting reads (admission numbers, question numbers, answers) go through the vision LLM — **not traditional OCR**. **Ship Lite-first** for identity/grouping; teacher amber confirm remains the quality gate. Flash/Pro auto-escalation is a contingency, not a PSL-45 prerequisite (see Phase 0 below).

**Deprecated for vision:** Grok/xAI — no API access; not recommended for production OCR per 2026 benchmarks (hallucination risk). `XAI_API_KEY` / `CHAT_PROVIDER=xai` remain optional for chat experiments only, not the vision path.

**In-app SDK:** Vercel AI SDK (`ai` package). Not Cursor SDK (developer automation only).

## Consequences

- Migration `20260701_voyage_embedding_dims.sql` resizes pgvector to 1024.
- Env: `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL`, `DEEPSEEK_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CHAT_PROVIDER`.
- **Testing:** Gemini free tier is sufficient for local dev and QA (see Sprint 4 sign-off). Enable Cloud billing (paid tier) before production — Google does not use paid-tier prompts for model training.

### Sprint 5 Phase 0 — Vision benchmark (deferred)

**Decision (2026-07-10, [PSL-50](https://nervustechnologies.atlassian.net/browse/PSL-50)):** Do **not** block [PSL-45](https://nervustechnologies.atlassian.net/browse/PSL-45) on a pre-implementation 20–30 sample Lite→Flash→Pro lab.

| Locked now | Deferred |
|------------|----------|
| Default model: `gemini-2.5-flash-lite` | Calibrated Lite→Flash / Flash→Pro confidence thresholds |
| Amber teacher confirm for missing / unreadable / off-roster IDs (AC-5.4, AC-5.8) | Auto-escalation stack in product code |
| Synthetic / generated images OK for **pipeline** QA (grouping, amber UI, conflicts) | Accuracy verdict from Gemini-generated handwriting alone |

**Rationale:** Teacher review is already the quality gate. Lite is the ADR default; escalation can land after real (or pilot) handwriting evidence — synthetic neat handwriting is a weak proxy for Kenyan classroom scripts.

**Follow-up (not a PSL-45 blocker):** If Lite misreads real scripts in QA/pilot, add Flash/Pro fallback (or switch default) and record thresholds here. Prefer a thin model-id / escalate-on-amber escape hatch in PSL-45 so that change is not a rewrite.

**Status:** Complete (deferred) — PSL-45 may open.

## Mirror in Confluence

Duplicate this page under PLEARN → Architecture when publishing sprint docs.
