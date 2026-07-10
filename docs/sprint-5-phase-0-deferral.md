# Sprint 5 Phase 0 — Vision benchmark deferral

**Approved:** 2026-07-10  
**Ticket:** [PSL-50](https://nervustechnologies.atlassian.net/browse/PSL-50)  
**Unblocks:** [PSL-45](https://nervustechnologies.atlassian.net/browse/PSL-45)  
**Spec:** [docs/sprint-3-specs.md](./sprint-3-specs.md) § Sprint 5 · [ADR-003](./adr-003-ai-provider-rag.md)

## Locked decisions

| Decision | Resolution |
|----------|------------|
| Pre-PSL-45 20–30 sample Lite→Flash→Pro lab | **Deferred** — not a branch gate |
| Default vision model for identity/grouping | `gemini-2.5-flash-lite` |
| Quality gate for bad reads | Amber flag + teacher confirm/reassign (AC-5.4, AC-5.8) |
| Flash / Pro auto-escalation | Contingency after real or pilot handwriting evidence |
| Gemini-generated images | OK for **pipeline** QA only; not the accuracy verdict for Kenyan handwriting |
| Prefer thin escape hatch in PSL-45 | Model id / escalate-on-amber hook so a later switch is not a rewrite |

## Rationale

Teacher review is already the product quality gate. Blocking identity work on a calibrated tier lab delays Sprint 5 without changing the ship shape (Lite + amber). Synthetic neat handwriting is a weak proxy for classroom scripts; accuracy tuning belongs after real pages are available.

## Follow-up (not PSL-45)

If Lite misreads real scripts in QA or pilot:

1. Escalate or switch default (Flash / Pro).
2. Record thresholds and escalation rates in [ADR-003](./adr-003-ai-provider-rag.md).
3. Open a follow-up ticket (`type-tech-debt` or `type-feature`) if product code needs the full tier stack.

## Jira actions

Post on PSL-45 (and optionally PSL-44):

```text
PSL-45 — Phase 0 vision benchmark deferred (PSL-50)
ADR-003 + docs/sprint-5-phase-0-deferral.md
Lite-first; amber teacher confirm; Flash/Pro contingency later
Gate cleared: PSL-45 may open after PSL-44 (Done)
```
