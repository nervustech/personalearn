# Retrospective: Sprint 3

**Epic:** [PSL-3 — v1.0 Program: Agent-centric MVP](https://nervustechnologies.atlassian.net/browse/PSL-3)  
**Sprint window:** 2026-07-06 → 2026-07-08 (re-scoped stack merged to `develop`)  
**Release notes:** [docs/sprint-3-release-notes.md](../sprint-3-release-notes.md)

## Sprint goal

AI Hub v2 — class-scoped chat with conversation history sidebar and a class assistant agent that queries ingested materials, generates learning resources as drafts, and saves to class resources only after explicit teacher confirmation.

**Shipped stack (merge order):** PSL-42 → PSL-7 → PSL-27 (PRs #28, #29, #30)

## Keep doing

- One ticket → one branch → one PR, merged sequentially
- Phase 0 requirements sign-off with Given/When/Then ACs before opening feature branches ([sprint-3-sign-off.md](../sprint-3-sign-off.md))
- Colocated unit and API route tests in the same PR as the feature
- Provider abstraction (`getChatModel`, DeepSeek for text chat per [ADR-003](../adr-003-ai-provider-rag.md))
- `docs/` mirrors for Confluence publishing (specs, decision log, release notes)
- Reuse Sprint 2 RAG + ingest pipeline instead of rewriting (`queryClassResources`, `ingestTxtResource`)
- Human-in-the-loop writes: agent asks in chat before calling `save_resource`

## Start doing

- Apply new migrations on dev Supabase **before** Vercel preview QA for each PR (`20260706`, `20260708`)
- Publish sprint retros and release notes to Confluence at sprint close (PLEARN → Releases / Retros)
- Preview-first QA on Vercel before opening PR when UX needs hands-on validation (used on PSL-27)

## Stop doing

- Bundling multiple tickets on one branch (root cause of the original Sprint 3 reset — see [sprint-3-decision-log.md](../sprint-3-decision-log.md))
- Marking sprint complete before merge to `develop`
- Thin bullet-point specs that leave ambiguity to be resolved in implementation

## What went well

- Replan paid off: three focused PRs delivered the full AI Hub v2 vertical slice without scope creep
- Agent tool pattern (`search_class_resources`, `generate_learning_resource`, `list_students`, `save_resource`) is extensible for Sprint 4–5
- `teacherConfirmed: true` gate on `save_resource` enforces confirm-before-write at the schema level
- 86 tests green at sprint close; CI passed on all three PRs

## What could improve

- Resource list UI still missing — teachers cannot browse agent-saved items until Sprint 4 (PSL-43)
- Draft iteration is chat-native only; no structured artifact editor (acceptable for MVP, watch teacher feedback)
- Confluence publish lag — resolved; mirrored to [Retrospective: PSL Sprint 3](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/9830402) and [Sprint 3 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/10059777)

## Action items

- [ ] Kick off Sprint 4: [PSL-43](https://nervustechnologies.atlassian.net/browse/PSL-43) — class resources section (upload any type + unified list with agent-saved items)
- [ ] Confirm dev Supabase has migrations `20260706_ai_hub_conversations` and `20260708_resources_resource_type` applied on all preview environments
- [ ] Carry forward: Grok/xAI for vision reads in Sprint 5 bulk evaluation (locked in Phase 0 sign-off)

## Deferred to later sprints

| Sprint | Ticket | Capability |
|--------|--------|------------|
| 4 | PSL-43 | Class resources section — list, upload, open, delete |
| 5 | PSL-8 | Bulk evaluation + review queue |
| 5 | PSL-38 | Dashboard competency snapshot |
| 6 | PSL-10, PSL-39, PSL-40, PSL-41 | Export, PWA, production launch |
