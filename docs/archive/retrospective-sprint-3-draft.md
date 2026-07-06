# Retrospective: Sprint 3 (ABANDONED DRAFT)

> **Status:** Abandoned — sprint not completed; local work discarded during replan. Do not publish to Confluence.

## Sprint goal

Ship PersonaLearn v1.0 with lesson generation, multimodal feedback, competency tracking, PDF exports, PWA, and production launch.

## Keep doing

- One ticket → one branch → one PR (where feasible)
- Colocated unit tests for AI modules
- Provider abstraction (`getChatModel`, `getChatModelForProvider`)
- `docs/` mirrors for Confluence publishing

## Start doing

- Apply new migrations on dev Supabase before preview QA each sprint
- Separate production Supabase project from day one of launch sprint
- Signed URLs for private storage buckets (not `getPublicUrl`)

## Stop doing

- Deferring infra tickets (PSL-38–41) to mid-sprint — triage in Phase 0
- Bundling multiple tickets on one branch
- Marking sprint complete before merge to `develop`

## Lessons carried into replan

- Split v1.0 across Sprints 3–6 (lesson loop → assessment → export/PWA → prod launch)
- Full Given/When/Then acceptance criteria before branching
- Requirements sign-off gate before implementation
