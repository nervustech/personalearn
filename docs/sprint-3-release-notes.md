# Sprint 3 — Release Notes

**Sprint goal:** AI Hub v2 — class-scoped conversational agent with history, RAG query, resource generation, and save-on-confirm ([PSL-3](https://nervustechnologies.atlassian.net/browse/PSL-3)).

**Spec:** [docs/sprint-3-specs.md](./sprint-3-specs.md) · **Retro:** [docs/archive/retrospective-sprint-3-draft.md](./archive/retrospective-sprint-3-draft.md)

## Shipped (merged to `develop`)

| Jira | Summary | PR | Key paths |
|------|---------|-----|-----------|
| PSL-42 | AI Hub v2 — chat UI + conversation history | [#28](https://github.com/nervustech/personalearn/pull/28) | `/ai-hub`, `/api/ai-hub/chat`, `/api/ai-hub/conversations`, `src/components/ai-hub/*`, `supabase/migrations/20260706_ai_hub_conversations.sql` |
| PSL-7 | Class assistant agent — RAG query + generate tools | [#29](https://github.com/nervustech/personalearn/pull/29) | `src/lib/ai-hub/agent-tools.ts` (`search_class_resources`, `generate_learning_resource`, `list_students`) |
| PSL-27 | Agent save-on-confirm to class resources | [#30](https://github.com/nervustech/personalearn/pull/30) | `save_resource` tool, `src/lib/ai/ingest-resource.ts`, `supabase/migrations/20260708_resources_resource_type.sql` |

## Capabilities delivered

1. **Chat + history** — Main thread with streaming replies; sidebar lists prior conversations per class; new conversation auto-titles from the first message.
2. **Class-scoped agent** — Assistant uses tools to search ingested materials (with citations), generate drafts (scheme of work, assignment, notes, marking scheme, quiz, examination), and read the student roster for context.
3. **Save on confirmation** — Agent proposes saving a draft in chat; `save_resource` runs only after explicit teacher confirmation (`teacherConfirmed: true`). Saved content is ingested for RAG with `ai_generated: true` and a `resource_type` label.

## Database migrations (apply on dev Supabase before QA)

| Migration | Purpose |
|-----------|---------|
| `20260706_ai_hub_conversations.sql` | `conversations` + `conversation_messages` tables with RLS |
| `20260708_resources_resource_type.sql` | `resource_type` column on `resources` (incl. `quiz`, `examination`) |

Prior Sprint 2 migrations (`20260701`, `20260702`) remain required for RAG ingest.

## Environment (Vercel preview)

- `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL=voyage-3.5`
- `DEEPSEEK_API_KEY`, `CHAT_PROVIDER=deepseek`
- Supabase dev project URL + anon/service keys

## Manual QA (Vercel preview)

1. Sign in → select a class with an ingested TXT scheme (Sprint 2 upload flow).
2. Open **AI Hub** → confirm chat layout + empty or populated history sidebar.
3. Ask *"What does Week 3 cover?"* → confirm cited answer from class materials (AC-3.5).
4. Ask *"Create a Grade 7 fractions assignment"* → confirm draft in chat, **no** auto-save (AC-3.6).
5. Reply *"Yes, save it as an assignment"* → confirm success message; resource persisted with `resource_type` and RAG re-query finds it (AC-3.7).
6. Start a **new conversation**; switch classes in the header → sidebar shows only conversations for the active class (AC-3.2–3.4).
7. (Optional) Generate a quiz or examination draft → save on confirm → verify `resource_type` in DB.

## Deferred to Sprint 4+

| Item | Ticket | Notes |
|------|--------|-------|
| Class resources section (list / upload / open / delete) | PSL-43 | Agent-saved items exist in DB but no dedicated UI yet |
| Multi-format upload (PDF, images) | PSL-43 | TXT ingest from Sprint 2 still available |
| Bulk evaluation workflow | PSL-8 | Sprint 5 |
| Student evaluation / competency writes | PSL-8, PSL-38 | Explicitly out of PSL-27 scope |
| Dashboard competency snapshot | PSL-38 | Sprint 5 |
| Production launch + `v1.0.0` | PSL-40, PSL-41 | Sprint 6 |

## Mirror in Confluence

Published under [PLEARN → Releases](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/10059777/Sprint+3+Release+Notes). Retro: [Retrospective: PSL Sprint 3](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/9830402).
