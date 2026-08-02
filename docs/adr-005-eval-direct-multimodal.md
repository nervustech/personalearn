# ADR-005 — Direct multimodal evaluation (Gemini Batch + live sync)

**Status:** Accepted (2026-08-02)  
**Epic:** PSL-55 (reset scope)  
**Supersedes:** [ADR-004 — Evaluation pipeline rehaul](adr-004-eval-pipeline-rehaul.md)  
**Related:** ADR-003 (vision tiering), [eval-direct-multimodal.md](eval-direct-multimodal.md)

## Context

ADR-004 built a Postgres job queue, parse cache, and text-first grading spine (~8k LOC orchestration) while multimodal LLMs already perform OCR + reasoning in one pass. Gemini research confirms: for pen-and-paper student worksheets, **direct vision grading with structured JSON** is simpler, cheaper, and preserves spatial math context better than parse-then-grade pipelines.

## Decision

1. **One grading brain, two transports** — shared prompts/schemas; Gemini **Batch API** for class uploads; sync `generateContent` for single-student live grading.
2. **Two-phase pipeline** — Phase 1 index (admission + page metadata) → group by admission → Phase 2 evaluate (multi-image packet + answer key → UI JSON).
3. **v1 guardrails** — content-hash upload dedupe, identity amber, vision escalation, bounded retries, targeted re-eval, teacher edit.
4. **No parse cache / job workers** — drop `evaluation_jobs`, `page_parses`, grade-from-parse, draft orchestration.
5. **Tables** — `evaluation_batches` (session + `mode`), `evaluation_pages`, `evaluated_scripts`, `question_evaluations`, `gemini_batch_jobs`.

## Consequences

- Batch turnaround is minutes; live sync covers instant single-student review.
- ADR-004 Epic F slices (PSL-84…97) are halted; new stories track ADR-005 delivery.
- Bounding-box crops remain deferred; page_number + vertical_bounds suffice for v1 sync.
