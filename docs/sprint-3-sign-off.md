# Sprint 3 Phase 0 sign-off record

**Approved:** 2026-07-06  
**Epic:** [PSL-3](https://nervustechnologies.atlassian.net/browse/PSL-3)  
**Spec:** [Confluence v1.0 Program Specs](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/8388609) · [docs/sprint-3-specs.md](./sprint-3-specs.md)

## Tickets (merge order)

1. [PSL-42](https://nervustechnologies.atlassian.net/browse/PSL-42) — AI Hub v2 chat UI + conversation history
2. [PSL-7](https://nervustechnologies.atlassian.net/browse/PSL-7) — Class assistant agent (generate + RAG tools)
3. [PSL-27](https://nervustechnologies.atlassian.net/browse/PSL-27) — Agent save-on-confirm

## Locked decisions

| Decision | Resolution |
|----------|------------|
| Sprint 3 chat provider | DeepSeek (`CHAT_PROVIDER=deepseek`) |
| Vision (Sprint 5) | Grok/xAI for handwriting reads |

## Design review (AC traceability)

Manual QA script from spec — verified testable before implementation:

1. AI Hub + ingested scheme → cited answer (AC-3.5 / PSL-7)
2. Generate fractions assignment → draft, no auto-save (AC-3.6 / PSL-7)
3. Confirm save → persisted + RAG (AC-3.7 / PSL-27)
4. Second conversation + class switch → sidebar scoping (AC-3.2, AC-3.3 / PSL-42)
5. Non-owner API calls → 403 (AC-3.9 / all tickets)

## Jira actions (paste if MCP comment blocked)

Post on PSL-3:

```text
PSL-3 — Sprint 3 requirements signed off (Phase 0)
Spec: https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/8388609
Tickets: PSL-42 → PSL-7 → PSL-27
Chat provider: DeepSeek (ADR-003 updated)
Approved: 2026-07-06
```

Sprint **PSL Sprint 3** end date: extend to **2026-07-20** (2-week window from 2026-07-06).
