# Sprint 5 — Release Notes

**Sprint goal:** Bulk evaluation + student bridge — teachers can bulk- or single-upload pen-and-paper scripts, group by admission number (Gemini vision), draft per-question marks, review/re-evaluate, sign off, and see results on the student profile and dashboard ([PSL-8](https://nervustechnologies.atlassian.net/browse/PSL-8)).

**Spec:** [docs/sprint-3-specs.md](./sprint-3-specs.md) § Sprint 5 · **Retro:** [docs/retrospective-sprint-5.md](./retrospective-sprint-5.md) · **Phase 0:** [docs/sprint-5-phase-0-deferral.md](./sprint-5-phase-0-deferral.md)

**Confluence:** [Sprint 5 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/13205505) · [Retrospective: PSL Sprint 5](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/13172737)

## Shipped (merged to `develop`)

| Jira | Summary | PR |
|------|---------|-----|
| PSL-44 | Eval schema + start + bulk upload; gradable save → assessment | [#34](https://github.com/nervustech/personalearn/pull/34) |
| PSL-50 | Defer Phase 0 vision benchmark — Lite-first for PSL-45 | [#35](https://github.com/nervustech/personalearn/pull/35) |
| PSL-51 | Document multi-commit-by-AC on feature branches | [#36](https://github.com/nervustech/personalearn/pull/36) |
| PSL-45 | Eval identity + grouping by admission number | [#37](https://github.com/nervustech/personalearn/pull/37) |
| PSL-46 | Eval per-question drafts vs marking scheme | [#38](https://github.com/nervustech/personalearn/pull/38) |
| PSL-47 | Eval review queue + sign-off | [#39](https://github.com/nervustech/personalearn/pull/39) |
| PSL-52 | Eval review workspace UX (split-pane + review-first) | [#40](https://github.com/nervustech/personalearn/pull/40) |
| PSL-54 | Math-capable Markdown (chat + resource preview) | [#41](https://github.com/nervustech/personalearn/pull/41) |
| PSL-53 | Eval review polish (A4 pane + dense nav + auto-draft) | [#42](https://github.com/nervustech/personalearn/pull/42) |
| PSL-48 | Roster student profile + per-student (`N=1`) eval | [#43](https://github.com/nervustech/personalearn/pull/43) |
| PSL-38 | Dashboard competency snapshot | [#44](https://github.com/nervustech/personalearn/pull/44) |

**Umbrella:** [PSL-8](https://nervustechnologies.atlassian.net/browse/PSL-8) — tracking parent only; not implemented as a mega-PR.

## Capabilities delivered

1. **Start + upload (AC-5.1, AC-5.2, AC-5.16)** — Start evaluation from a class assessment; attach marking scheme or proceed without; bulk multi-image upload. Gradable AI Hub saves (`assignment` / `quiz` / `examination`) create a linked class `assessments` row immediately.
2. **Identity + grouping (AC-5.3, 5.4, 5.8, 5.9, 5.12)** — Gemini vision reads admission/question numbers; pages group per student vs roster; amber confirm, missing-page, and duplicate conflict flags before grading.
3. **Per-question drafts (AC-5.5)** — Background draft pass for identity-cleared scripts; with scheme → `ai_draft`; without → `ai_estimate` + amber.
4. **Review + sign-off (AC-5.6, 5.7, 5.10, 5.11)** — Edit marks/feedback; single-question re-eval; sign-off writes `student_submissions` + `competency_progress` (drafts never persist as results before sign-off).
5. **Student profile bridge (AC-5.13–5.15)** — Click a student → assessments list + status; evaluate/upload for one student (`N=1` batch); view signed-off feedback without re-running vision.
6. **Dashboard competency (PSL-38)** — Per-student competency snapshot from `competency_progress` after sign-off.
7. **Review UX polish (PSL-52, PSL-53)** — Split-pane review workspace, A4 script pane, dense nav, auto-draft.
8. **Math Markdown (PSL-54)** — KaTeX-capable rendering in chat and resource preview.

## Database migrations (apply on dev Supabase before QA)

| Migration | Purpose |
|-----------|---------|
| `20260709_evaluation_batches.sql` | Evaluation batches, scripts, question evaluations (+ RLS) |
| `20260711_question_evaluations_unique.sql` | Unique constraint on question evaluations |
| `20260713_competency_progress_unique.sql` | Unique competency progress upserts |
| `20260713_question_evaluations_analysis.sql` | Grounded analysis fields on question evaluations |
| `20260713_student_submissions_unique.sql` | Unique student submissions |
| `20260716_backfill_assessments_gradable_resources.sql` | Backfill assessments for existing gradable resources |
| `20260716_evaluation_batches_scoped_student.sql` | Scoped student support for `N=1` batches |

## Environment

Add / confirm in `.env.local` / Vercel:

- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini vision (eval identity + drafts)
- Optional: `EVAL_VISION_MODEL` — override default Lite model (`gemini-3.1-flash-lite`); no auto-escalation ladder
- Existing: `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`, Supabase keys

## Manual QA (end-to-end)

1. Generate + approve an assignment and a marking scheme in AI Hub; confirm the assignment appears on a student profile as `not_started`.
2. Start evaluation, attach the scheme, bulk-upload a **shuffled** mixed stack of scripts.
3. Confirm pages group per student by admission number; leave one page without an ID → amber; assign from the image.
4. Confirm drafts appear after identity is cleared; edit one mark; re-evaluate one question with an instruction.
5. Sign off → confirm `student_submissions` + competency on profile and dashboard.
6. From a student profile, start Evaluate / Upload for one assessment (`N=1`).

## Deferred to Sprint 6+

| Item | Ticket |
|------|--------|
| Simple report export | PSL-10 |
| PWA offline shell (optional) | PSL-39 |
| Production Supabase | PSL-40 |
| Production deploy + `v1.0.0` | PSL-41 |
| Flash/Pro vision auto-escalation (after real handwriting evidence) | Contingency / ADR-003 |
| Term analytics, non-image scans, mark audit trail | Out of MVP |
