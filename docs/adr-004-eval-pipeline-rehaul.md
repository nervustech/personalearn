# ADR-004 — Evaluation pipeline rehaul (async queue, parse cache, split-pane review)

**Status:** Proposed (2026-07-26) — revises the 2026-07-19 ADR-004 stub with locked implementation decisions
**Epic:** [PSL-55](https://nervustechnologies.atlassian.net/browse/PSL-55) / Epic F, stories F1–F10
**Related:** ADR-003 (AI provider + vision tiering), `docs/eval-page-parse-cache-phases.md`, PSL-8 family (Sprint 5 eval), PSL-45 (identity)
**Supersedes for eval flow:** the synchronous `processBatchDrafts` request model and the per-batch amber gate.

## Context

The current evaluation pipeline (see the pipeline map in `docs/eval-page-parse-cache-phases.md`) has three problems the team has hit in practice:

1. **No queueing.** Drafting runs synchronously inside one HTTP request (`processBatchDrafts` → sequential per-question vision calls), kicked off by a client `useEffect` auto-draft in `IdentityReviewPanel`. While a batch is grading, the tab is blocked, function timeouts cap batch size, and no further evaluation work can start.
2. **Amber blocks the batch.** Unresolved identity exceptions keep the whole batch in a foreground "setup" state instead of letting already-cleared scripts grade.
3. **Duplicate parsing.** Identity (`read-script-page.ts`) and draft (`draft-question.ts`) run independent vision passes over the same pixels — extra cost and latency, and the two passes can disagree on what belongs to a question.

Separately, the review surface (~660-line `eval-review-workspace.tsx` + auto-opened `IdentityReviewPanel`) is not the intended experience: teachers want a deep-linkable split-pane review and a way to start reviewing finished scripts while others are still processing.

The original ADR-004 (2026-07-19) recorded the Epic F direction at a high level (F1–F10). This revision **locks the implementation decisions** and **re-orders delivery**: the async queue lands first (it is what removes the pain), and the parse cache slots in as "what each job does." It also defers bounding boxes/crops to a later phase rather than treating them as a launch prerequisite.

## Decision

### 1. Batch = long-lived grading session (append model)

- A batch is a durable grading session for one assessment. **Drop "upload only in `draft`."** Scripts can be appended at any time; new pages enter `pending` and ride the same queue.
- **`evaluation_batches.status` becomes a rollup** derived from its scripts, not a lock:
  - `processing` — any script is `parsing`/`drafting` (or queued).
  - `in_review` — no script in flight; at least one `drafted` awaiting a teacher.
  - `signed_off` — all reviewable scripts signed off.
- The **student-level guard is the real invariant** (unique `student_submissions (assessment_id, student_id)` + `getStudentAssessmentEvalState`). The former per-batch "one open batch" index is relaxed to "one *session* per assessment"; double-grading a student stays impossible.

### 2. Amber is a per-script gate, never a per-batch gate

- Routing runs **per script** off its parse rows.
- `identity_cleared` → enqueue draft jobs immediately.
- `identity_amber` → held in place; **the batch keeps grading every other script.** When the teacher resolves identity, that script is enqueued and *joins the running pipeline*.
- Nothing ever waits on the amber pile.

### 3. Async worker + queue — Postgres jobs table + `waitUntil`, Cron as sweeper

Chosen mechanism (no new infra; native to Supabase + Vercel Fluid Compute):

- **`evaluation_jobs` table.** Workers claim rows with `SELECT … FOR UPDATE SKIP LOCKED`; bounded concurrency via `p-limit`.
- **Immediate drain.** Enqueueing routes trigger processing via `after()` / `waitUntil` so dots move in seconds (no Cron-poll lag).
- **Cron sweeper** (every minute) re-queues stuck/failed jobs with backoff — retries + straggler recovery.
- **Idempotency key** `(script_id, question_label, parse_version)`; replays never double-write. On success a job upserts its `question_evaluations` row and advances script status.

Rejected alternatives: `pgmq` and Vercel Queues (beta) are viable upgrades but add magic/beta risk; a plain jobs table is easier to test (colocated tests), inspect, and reason about. **pgmq is the documented upgrade path** if throughput demands it.

### 4. Parse once, consume many (parse-cache Phase A)

- One rich vision pass per **unique blob** per batch → `page_parses` (admission, question labels, per-question `blocks[].text`, `raw_transcript`, confidence). Keyed by `(batch_id, storage_path)`.
- Identity **and** draft read from `page_parses` instead of re-prompting the same pixels. This is the doc's "parse once, consume many" spine and the reason the doc was raised — it removes the duplicate parse, cutting cost and latency.
- **No cross-batch parse reuse in v1** (parses are batch-scoped). Parsing is cheap relative to a wrong-grade incident, and cross-assessment reuse invites context bleed + invalidation complexity. `content_hash` is stored so reuse can be switched on later if metrics justify it.

### 5. Grading mode is configurable — text-first pilot, cheap revert

- Persist `raw_transcript` + `blocks[]` on every parse row **regardless of grade mode**.
- Grade path behind **`EVAL_GRADE_MODE = text | image | hybrid`**:
  - Pilot: `text` (grade from cached transcript + scheme) — modern multimodals transcribe well; test it directly.
  - `hybrid`: text for prose, image for blocks flagged `diagram`/low-confidence.
  - `image`: current behaviour (image in every grade call).
- Reverting is a **config flip, not a code change.** Log `{model_id, grade_mode, confidence, awarded}` per question to A/B text vs image on the same scripts and decide on evidence (extends ADR-003 vision-tier hedge).

### 6. Split-pane review page (deep-linkable, no auto-open)

- Route: `…/classes/[classId]/assessments/[assessmentId]/review/[scriptId]` under **Classes** (breadcrumb-consistent: class → assessment → student). Not a modal; not auto-opened.
- Layout: **left** submission image (+ zoom); **right** AI analysis (student vs correct, explanation, editable suggested feedback, Add to Report); **per-question nav** drives both panes; header shows Total Score (`computeScriptTotal`) + Finalize Grade (`signOffScript`); an `ATTENTION NEEDED` badge surfaces low-confidence/wrong questions.
- **v1 highlight is block/page-level** (scroll to the page/region for the question via parse `blocks`). Pixel-accurate bounding-box crops are **deferred to Phase B**.
- Natural-language re-prompt on the focused question (F9). **No hashtag command / no `#evaluate` chip** — the teacher just types ("why did this lose a mark?").

### 7. Realtime dot indicators on the roster / student profile

One dot per student for the active assessment, driven by the furthest-along script state, updated **live via Supabase Realtime** on `evaluated_scripts` (no polling):

| Dot | Script state | Meaning | Action |
|-----|--------------|---------|--------|
| ○ grey | none / `not_started` | nothing uploaded | — |
| ◐ pulsing | `parsing` / `drafting` (queued) | in the queue | "processing…" |
| ● amber | `identity_amber` | needs identity confirm | assign inline |
| ● indigo (accent) | `drafted` | **ready to review** | open split-pane review |
| ● green | `signed_off` | done | open read-only review |

The moment a script hits `drafted` its dot turns indigo and the teacher can review it while others still process. A compact queue summary on the assessment header aggregates the same states ("28 ready · 4 grading · 3 need identity · 5 done").

## Status machine (target)

```
script:  pending → parsing → (routed) ─┬─ identity_cleared → queued_draft → drafting → drafted → signed_off
                                       └─ identity_amber ──(teacher assign)──▶ identity_cleared → …

batch:   processing (any script in flight)
         → in_review (none in flight, ≥1 drafted)
         → signed_off (all reviewable signed off)

question_evaluations.status: ai_draft | ai_estimate | teacher_edited | reevaluated   (unchanged)
```

## Schema deltas

Illustrative; finalise in migration + `src/types/database.ts`.

- **New `page_parses`** — per `docs/eval-page-parse-cache-phases.md` (`batch_id`, `storage_path`, `content_hash`, `parse_version`, `model_id`, `admission_number`, `raw_transcript`, `blocks jsonb`, `page_confidence`, `status`, `parsed_at`; unique `(batch_id, storage_path)`).
- **New `evaluation_jobs`** — `id`, `batch_id`, `script_id?`, `job_type` (`parse_page | draft_script | draft_question`), `dedupe_key`, `status` (`queued | running | done | failed`), `attempts`, `run_after`, `last_error`, `locked_at`, timestamps. Claimed via `FOR UPDATE SKIP LOCKED`.
- **`evaluated_scripts.status`** — add `parsing`, `queued_draft`, `drafting` to the existing enum (`pending | identity_amber | identity_cleared | drafted | signed_off`).
- **`evaluation_batches.status`** — add `processing`; treat status as derived/rollup.
- **`EvaluatedScriptPage`** — optional `parseId?`, `parseStatus?` referencing `page_parses` (no transcript duplication).
- **Deferred (Phase B):** `question_evaluations.bounding_boxes` (F5); `PageParseBlock.bbox`.

## Consequences

- New env: `EVAL_GRADE_MODE` (default `text` for pilot); optional `EVAL_PAGE_PARSE_CACHE` flag for staged rollout.
- Uploads move toward direct-to-storage signed URLs (F1) so appended scripts bypass the 4.5 MB body limit; the queue makes large batches safe against function timeouts.
- Review no longer auto-opens (F4); completion is surfaced via dots + roster/assessment entry points (F10) and rail notifications (A6).
- Backward compatible: batches without `page_parses`/`evaluation_jobs` rows fall back to the legacy synchronous path behind the flag until deprecation.
- Testing: colocated unit tests for the job claimer (idempotency, SKIP LOCKED semantics via mocked client), parse-cache upsert, per-script amber routing, and status rollups; keep synthetic images for pipeline QA (ADR-003 Phase 0), real/pilot handwriting for the `text` vs `image` grade verdict.

## Rollout (re-ordered vs the phase doc)

| # | Deliverable | Epic F tie | User-visible |
|---|-------------|------------|--------------|
| 1 | `evaluation_jobs` + worker (`waitUntil` + Cron sweeper); async draft | F3 | Teacher keeps working; batch `processing → in_review` |
| 2 | Per-script amber gate + status rollup + batch-as-session (append) | F3 | Cleared scripts grade while amber waits; queue more anytime |
| 3 | Split-pane review route + entry points + no auto-open | F8/F10/F4 | Intended review UX |
| 4 | Realtime dot indicators + queue summary | new (A6-adjacent) | Start reviewing finished scripts early |
| 5 | Parse-cache Phase A + `EVAL_GRADE_MODE=text` pilot | doc Phase A | Cheaper/faster, single parse |
| 6 | Evidence review → keep `text` or fall back `hybrid`/`image` | F7 / ADR-003 | Accuracy locked on evidence |
| — | Deferred: Phase B bbox/crops (F5/F6), Phase C parse-edit | F5/F6 | Pixel-accurate highlight, crop re-prompt, parse review |

## Alternatives considered

- **Keep synchronous drafting, just raise timeouts** — does not enable queueing or non-blocking amber; rejected.
- **Multiple batches per assessment** (vs append) — simpler concurrency but scatters a student's scripts across batches and complicates the single review surface; rejected in favour of the session model.
- **`pgmq` / Vercel Queues now** — deferred as upgrade paths; jobs table chosen for testability and zero beta risk.
- **Text-only grading permanently** — not committed; adopted only for the pilot behind `EVAL_GRADE_MODE`, revert on evidence.
- **Bounding boxes at launch** (original ADR-004 framing) — deferred to Phase B; v1 review uses block/page-level highlight.

## Open questions

1. Parse timing — at identity only, or eagerly per upload chunk once direct-to-storage (F1) lands? (Lean: at identity for v1, eager later.)
2. Worker execution budget under Fluid Compute for large batches — tune `p-limit` concurrency + per-invocation job cap against the 300s function ceiling.
3. Structured marking scheme (per-question JSON vs prose blob) would further help `text` grading accuracy — track separately from this ADR.

## Revision note

- **2026-07-19 (v1):** Original ADR-004 stub — Epic F direction (F1–F10), bounding boxes + crop re-prompt as core, agent-started async pipeline.
- **2026-07-26 (this revision):** Locks queue mechanism (jobs table + `waitUntil` + Cron), batch-as-session/append model, per-script non-blocking amber, parse-cache Phase A with configurable `EVAL_GRADE_MODE` text-first pilot, split-pane review route, and realtime dot indicators. Defers bounding boxes/crops (Phase B) and teacher parse-edit (Phase C).
