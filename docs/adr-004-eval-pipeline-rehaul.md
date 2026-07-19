# ADR-004 — Evaluation pipeline rehaul (async + bounding boxes)

**Status:** Accepted  
**Date:** 2026-07-19  
**Tickets:** [PSL-55](https://nervustechnologies.atlassian.net/browse/PSL-55) / F1–F10 (PSL-84–PSL-93)  
**Related:** [ADR-003](./adr-003-ai-provider-rag.md), Product Improvement Plan v1.1

## Context

Sprint 5 shipped a working evaluation vertical slice (schema → identity → drafts → review → sign-off). Teachers need:

1. Faster bulk uploads (avoid Vercel 4.5 MB serverless body limit)
2. Async “start grading, walk away, get notified” so the platform stays usable
3. Agent orchestration (start batch from AI Hub) without grading inside chat
4. Cheaper/faster single-question re-prompts via vision bounding boxes + crops
5. A simpler split-pane review UI with deep-link entry points (no auto-open modal)

## Decision

### Pipeline shape (deterministic + agent-orchestrated)

- **Upload** remains on the class/eval page via **direct-to-storage signed URLs** (Supabase Storage), not through the Next.js API body.
- **Agent tools** may **start** a batch and report status; they do **not** perform vision grading inside the chat transcript.
- A **background worker** with a **concurrency queue** moves batches `processing → drafted`.
- Review does **not** auto-open; agent + assessment tab + student profile deep-link into a **review page**.

### Schema (onto existing tables)

- `question_evaluations.bounding_box` — JSON array of `{ page, ymin, xmin, ymax, xmax }` (multi-page answers).
- `evaluation_batches` gains a first-class `processing` status (async in-flight).
- Draft persistence for AI Hub resources uses a `draftId` store; eval continues to use `evaluated_scripts` + `question_evaluations` as the draft layer before sign-off.

### Re-prompt

- Single-question re-eval crops to the stored bounding box and sends only that region (atomic micro-prompt).
- Submission-scoped re-prompt UI accepts **plain natural language** (no command hashtag).

### Vision tiers

- Lite-first remains default (ADR-003). Flash/Pro escalation is available but **evidence-gated** and off by default until real handwriting samples justify it.

## Consequences

- Faster, more reliable bulk uploads; teachers can multitask during grading.
- Smaller re-prompt payloads; review UI can highlight answer regions.
- Requires worker/queue infrastructure and notification surface in the app shell.
- Production deploy (PSL-40/41) waits until this rehaul freezes on `develop`.

## Alternatives considered

- Full autonomous agent grading loop — rejected (non-deterministic, costly).
- New parallel schema (Gemini’s Assignment/AnswerEvaluation tables) — rejected; refine existing PersonaLearn tables instead.
