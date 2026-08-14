# Retrospective: Sprint 6

**Epics:** [PSL-55](https://nervustechnologies.atlassian.net/browse/PSL-55) — v1.1 Product Improvements · [PSL-3](https://nervustechnologies.atlassian.net/browse/PSL-3) — v1.0 Program (Sprints 3–6)  
**Sprint window:** 2026-07-19 → 2026-08-13 (v1.1 UI + ADR-005 eval + production `v1.0.0`)  
**Release notes:** [docs/sprint-6-release-notes.md](./sprint-6-release-notes.md)  
**GitHub milestone:** [Sprint 6](https://github.com/nervustech/personalearn/milestone/6) (closed, 0 open)  
**Confluence:** [Sprint 6 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/21102593) · [Retrospective: PSL Sprint 6](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/21135361)

## Sprint goal

Ship the v1.1 product shell teachers actually use (matte design, home, classes, AI Hub), replace the eval pipeline with direct multimodal grading (ADR-005), and put `v1.0.0` on production (`main` + dedicated prod Supabase).

**Shipped stack:** PSL-56–83 (#88–#92) → PSL-95/55 docs (#93–#94) → PSL-86 ADR-005 (#95) → PSL-40/41 (#97, #99, #100) + tag `v1.0.0`.

## Keep doing

- One ticket → one branch → one PR for UI epics A–E (PRs #88–#92 stayed mergeable)
- Mandatory GitHub Issue intake before Jira/branch ([PSL-55](https://nervustechnologies.atlassian.net/browse/PSL-55) / #87)
- ADRs before doubling down on an eval architecture (ADR-004 proposed, then ADR-005 replaced it on evidence)
- Dedicated prod vs dev Supabase — never share the restore ([PSL-40](https://nervustechnologies.atlassian.net/browse/PSL-40))
- `docs/` mirrors for Confluence publishing at sprint close
- Human-in-the-loop eval: amber identity, teacher edit, sign-off as the persist gate

## Start doing

- Publish Confluence release notes + retro **the same day** the last sprint ticket merges (this closeout is a week of lag after `v1.0.0`)
- Close umbrella epics (PSL-55) when remaining children are explicitly deferred to Backlog — do not leave them In Progress
- Prefer split PRs even when the design is in flux; the ADR-005 umbrella (#95 carrying PSL-84, 87, 90–93, 96) was hard to review
- Create a GitHub **Release** when tagging `v1.0.x` (the tag landed; the Release did not)
- Move slipped v1.0 polish ([PSL-10](https://nervustechnologies.atlassian.net/browse/PSL-10), [PSL-39](https://nervustechnologies.atlassian.net/browse/PSL-39)) off the Sprint 6 title and onto Backlog so the board matches reality
- Delete or never commit superseded SQL (`20260727_evaluation_jobs.sql`, `20260728_page_parses_realtime.sql`)

## Stop doing

- Treating a two-day spec window (19–20 Jul) as the sprint — the real window ran to 13 Aug
- Implementing a full job-queue/parse-cache spine (ADR-004, ~8k LOC) while multimodal one-pass grading was already the simpler path
- Closing Epic F stories as Done when the work was bundled into a later umbrella PR without a traceable per-ticket PR
- Leaving production deploy “after feature freeze” in the spec while PSL-40/41 were the actual sprint closer

## What went well

- Epics A–E landed as five focused PRs in one day (25–26 Jul) with a coherent design language
- ADR-005 cut the eval orchestration surface: Batch + live sync, no `evaluation_jobs` / `page_parses` in prod
- Production isolation is real: `personalearn-prod` vs `personalearn-dev`, RLS smoke on two synthetic teachers
- `v1.0.0` exists on `main` ([tag](https://github.com/nervustech/personalearn/releases/tag/v1.0.0)); Vercel Production tracks `main`
- Golden-thread intake (Issue → PSL-N) held for the v1.1 story set (#46–#83)

## What could improve

- Closeout docs lagged the ship — Sprint 5 already called this out
- PSL-55 and PSL-3 still In Progress after the milestone closed
- PSL-10 / PSL-39 still titled `[Sprint 6]` while sitting in To Do outside the sprint
- PSL-49 stayed To Do after PSL-84 shipped the same direct-to-storage ACs — close the original tech-debt ticket when the replacement story merges
- ADR-004 Confluence page stayed “Proposed” after ADR-005 was accepted in the repo
- Failed Gemini Batch jobs do not reset script status; poll-batches / group-by-admission lack colocated tests (nits on #95)
- Vision accuracy on messy classroom handwriting is still unproven at scale

## Action items

- [x] Ship v1.1 shell (PSL-56–83)
- [x] Ship ADR-005 eval pipeline (PSL-86) and drop ADR-004 workers
- [x] Provision prod Supabase (PSL-40) and tag `v1.0.0` (PSL-41)
- [x] Close GitHub milestone Sprint 6
- [x] Publish Sprint 6 release notes + retrospective (repo + Confluence) — this closeout
- [x] Publish ADR-005 to Confluence Architecture; mark ADR-004 superseded
- [x] Create GitHub Release for `v1.0.0`
- [x] Close PSL-55: remaining child PSL-88 deferred to Backlog
- [x] Retitle / Backlog [PSL-10](https://nervustechnologies.atlassian.net/browse/PSL-10) and [PSL-39](https://nervustechnologies.atlassian.net/browse/PSL-39); PSL-3 stays open until those land or are explicitly cut from v1.0
- [x] Keep [PSL-88](https://nervustechnologies.atlassian.net/browse/PSL-88) / [#78](https://github.com/nervustech/personalearn/issues/78) on Backlog (bounding boxes)
- [x] Do not apply untracked ADR-004 migrations on any environment

## Deferred to later sprints

| Ticket | Capability |
|--------|------------|
| PSL-88 | Bounding boxes / pixel-accurate crops |
| PSL-10 | Simple student report export (print/PDF) |
| PSL-39 | PWA offline shell (optional) |
| — | Default Flash/Pro vision auto-escalation; term analytics |
