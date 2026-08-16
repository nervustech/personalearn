# Sprint 6 — Release Notes

**Sprint goal:** v1.1 product shell (matte design, home, classes, AI Hub) + evaluation rehaul (ADR-005 direct multimodal) + production ship (`v1.0.0`).

**Spec:** [v1.1 Product Improvements — Specs (Sprint 6)](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/14221313) · **ADR:** [ADR-005](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/21069825) ([repo](./adr-005-eval-direct-multimodal.md); supersedes [ADR-004](./adr-004-eval-pipeline-rehaul.md)) · **Retro:** [docs/retrospective-sprint-6.md](./retrospective-sprint-6.md)

**Confluence:** [Sprint 6 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/21102593) · [Retrospective: PSL Sprint 6](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/21135361)

**Window:** 2026-07-19 → 2026-08-13 · **GitHub milestone:** [Sprint 6](https://github.com/nervustech/personalearn/milestone/6) (closed) · **Release:** [v1.0.0](https://github.com/nervustech/personalearn/releases/tag/v1.0.0)

**Umbrella:** [PSL-55](https://nervustechnologies.atlassian.net/browse/PSL-55) (v1.1) · **v1.0 program:** [PSL-3](https://nervustechnologies.atlassian.net/browse/PSL-3)

## Shipped (merged to `develop`, then `main` as `v1.0.0`)

| Jira | Summary | PR |
|------|---------|-----|
| PSL-55 | Mandatory GitHub Issue intake before Jira/branch | [#87](https://github.com/nervustech/personalearn/pull/87) |
| PSL-56–63 | Matte design system + app shell (rail, tabs, theme, breadcrumbs) | [#88](https://github.com/nervustech/personalearn/pull/88) |
| PSL-64–68 | Home dashboard rework + assessment health | [#89](https://github.com/nervustech/personalearn/pull/89) |
| PSL-69–74 | Classes resources view + PDF/print | [#90](https://github.com/nervustech/personalearn/pull/90) |
| PSL-75–79 | AI Hub UX — cache, skeletons, attachments, search | [#91](https://github.com/nervustech/personalearn/pull/91) |
| PSL-80–83 | AI Hub agents — drafts, students, performance, image gen | [#92](https://github.com/nervustech/personalearn/pull/92) |
| PSL-95 | One open eval batch per assessment; flag repeats | [#93](https://github.com/nervustech/personalearn/pull/93) |
| PSL-55 | Mirror ADR-004 + Epic F grooming notes | [#94](https://github.com/nervustech/personalearn/pull/94) |
| PSL-86 | Direct multimodal eval pipeline (ADR-005); carries PSL-84, 87, 90–93, 96 | [#95](https://github.com/nervustech/personalearn/pull/95) |
| PSL-49 / PSL-84 | Eval bulk upload: signed-URL / RLS direct-to-Supabase (bypasses Vercel body limit) | [#95](https://github.com/nervustech/personalearn/pull/95) |
| PSL-40 | Provision production Supabase (`personalearn-prod`) | [#97](https://github.com/nervustech/personalearn/pull/97) |
| PSL-41 | Production ship checklist + eval poll secrets | [#99](https://github.com/nervustech/personalearn/pull/99) |
| PSL-41 | Promote `develop` → `main` + tag `v1.0.0` | [#100](https://github.com/nervustech/personalearn/pull/100) |

**Closed as superseded (not a separate PR):** [PSL-97](https://nervustechnologies.atlassian.net/browse/PSL-97) parse-cache Phase A (ADR-004) — replaced by ADR-005. [PSL-89](https://nervustechnologies.atlassian.net/browse/PSL-89) crop-based re-prompt closed with Phase B deferral.

## Capabilities delivered

1. **App shell (Epic A)** — Matte near-monochrome tokens; electric indigo accent; desktop left icon rail; mobile bottom tabs; More popover + theme; active-class in rail; floating surfaces; breadcrumbs; async-eval notifications.
2. **Home (Epic B)** — Performance as the primary view; assessment health cubes; recent conversations + resources; empty states; Students/AI Hub promo removed.
3. **Classes + resources (Epic C)** — Slim resources list; faster student eval profile; view original PDF/image; AI→PDF download consistency; editable text/AI resources; resource own page.
4. **AI Hub (Epics D–E)** — Cache-first conversations; loading skeletons; collapsible nav; composer file attachments; conversation title search; draft persistence by `draftId`; create/update student tools; grading/performance read tool; `teaching_aid` image gen.
5. **Eval pipeline (Epic F / ADR-005)** — Direct multimodal grading: Phase 1 index (admission + page metadata) → group-by-admission (amber/unmatched) → Phase 2 evaluate (multi-image packet + scheme). Gemini Batch for class uploads; sync `generateContent` for live single-student. Split-pane review, deep links, no auto-open, NL re-prompt, vision-tier escalation, realtime progress dots + queue summary. Dropped ADR-004 `evaluation_jobs` / `page_parses` workers.
6. **Bulk upload without Vercel body limits (PSL-49 / PSL-84)** — Pages go client → Supabase Storage (RLS upload, signed-URL fallback); `confirm-upload` only sends paths + hashes. Client compresses scans first; the legacy FormData `/upload` route is fallback-only.
7. **Production (`v1.0.0`)** — Dedicated prod Supabase (`ecwivelanrcjdgkyvbos`); Vercel Production on `main`; tag [`v1.0.0`](https://github.com/nervustech/personalearn/releases/tag/v1.0.0). Checklist: [docs/production-deploy-checklist.md](./production-deploy-checklist.md).

## Database (production)

Apply committed files in `supabase/migrations/` on **prod**. Skip untracked ADR-004 leftovers (`20260727_evaluation_jobs.sql`, `20260728_page_parses_realtime.sql`).

Expected public tables: `evaluation_batches`, `evaluated_scripts`, `evaluation_pages`, `question_evaluations`, `gemini_batch_jobs`.

## Environment

Confirm in Vercel **Production** (names only — never commit secrets):

- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` — prod project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`, `VOYAGE_API_KEY`
- `CRON_SECRET` — `/api/cron/eval-batch-poll` (GitHub Actions every 5m)
- Optional: `EVAL_VISION_MODEL`, `EVAL_VISION_ESCALATION=1`

Preview stays on **dev** (`personalearn-dev`). Local `.env.local` must not point at prod.

## Manual QA

1. Sign in on production (`https://personalearn.vercel.app`) as a **new** teacher (do not reuse a dev account).
2. Create a class + roster; confirm RLS (second teacher cannot see it).
3. Walk the shell: rail / tabs / theme / home health cubes / resource page.
4. Start a class eval: bulk upload → identity grouping → drafts → split-pane review → sign-off.
5. Start an `N=1` eval from a student profile (live sync path).
6. `GET /api/health` returns `status: ok` against prod Supabase (not the dev ref).

## Deferred

| Item | Ticket | Notes |
|------|--------|-------|
| Bounding boxes / pixel crops | [PSL-88](https://nervustechnologies.atlassian.net/browse/PSL-88) / [#78](https://github.com/nervustech/personalearn/issues/78) | Phase B; `page_number` + `vertical_bounds` suffice for v1 |
| Simple report export | [PSL-10](https://nervustechnologies.atlassian.net/browse/PSL-10) | Original v1.0 Sprint 6 polish; slipped |
| PWA offline shell | [PSL-39](https://nervustechnologies.atlassian.net/browse/PSL-39) | Optional; slipped |
| Flash/Pro auto-escalation as default | ADR-003 contingency | Escape hatch `EVAL_VISION_ESCALATION` exists |
