# Retrospective: Sprint 7

**Sprint window:** 2026-08-15 → 2026-08-21 (Jira sprint end 2026-08-28)  
**Goal:** Fix the critical bugs pausing production publishing (AI Hub + evaluation pipeline + onboarding).  
**Release notes:** [docs/sprint-7-release-notes.md](./sprint-7-release-notes.md)  
**GitHub milestone:** [Sprint 7](https://github.com/nervustech/personalearn/milestone/8)  
**Confluence:** [Sprint 7 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/23461889) · [Retrospective: PSL Sprint 7](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/23494657)

## Sprint goal

Ship the post-`v1.0.0` bugfix train so teachers can use AI Hub, eval, and first-run flows on production. Tag **`v1.0.2`** (after the 16 Aug `v1.0.1` PSL-102 hot-fix).

**Shipped stack:** PSL-102 (`v1.0.1`) → PSL-109 → PSL-106 → PSL-108 → PSL-103 → PSL-104 → PSL-101 → PSL-107 → PSL-99 → PSL-105 → PSL-100 → PSL-110.

## Keep doing

- One ticket → one branch → one PR (PRs #115–#130 stayed mergeable)
- Hot-fix the production-blocker on `main` immediately (PSL-102 / `v1.0.1`) then continue the rest on `develop`
- `docs/` mirrors + Confluence on the same day as the last merge
- Create a GitHub **Release** when tagging (Sprint 6 action item)

## Start doing

- Treat `main` hot-fixes as cherry-picks or fast promotes with an explicit revert plan (PSL-101 #122 → revert #124 → corrected #123)
- Strip `needs-triage` when closing intake issues (PSL-110 / #129 still carried it)
- Keep eval and AI Hub regressions covered by colocated tests when the bug is orchestration, not “vision quality”

## Stop doing

- Merging a landing/onboarding redirect to `main` before the no-class vs returning-teacher cases are both proven
- Leaving production on a mix of `v1.0.1` plus a reverted commit while `develop` is a full sprint ahead

## What went well

- All 12 Sprint 7 Jira tickets (PSL-99–110) reached **Done**; GitHub milestone has 0 open issues
- AI Hub went from silent prod failure → streaming + attachments + drafts in-thread
- Eval duplicate-batch and identity-confirm friction were the two pipeline blockers called out in the sprint goal
- SDLC field requirements (PSL-109) landed as a chore alongside product bugs

## What could improve

- PSL-101 needed a production revert; the corrected behaviour only lived on `develop` until this closeout
- Closeout still waits on a human “promote develop” step — schedule it as soon as the last ticket merges
- Vision accuracy on messy handwriting remains unproven at classroom scale (carry-over from Sprint 6)

## Action items

- [x] Merge remaining Sprint 7 commits `develop` → `main` (merge commit; keep `develop`)
- [x] Tag `v1.0.2` and publish GitHub Release
- [x] Publish Sprint 7 release notes + retrospective (repo + Confluence)
- [x] Close GitHub milestone Sprint 7
- [ ] Confirm Vercel Production deploy + `/api/health` after merge
- [ ] Complete remaining Sprint 6 Backlog polish only if pulled: PSL-10, PSL-39, PSL-88

## Deferred to later sprints

| Ticket | Capability |
|--------|------------|
| PSL-88 | Bounding boxes / pixel-accurate crops |
| PSL-10 | Simple student report export (print/PDF) |
| PSL-39 | PWA offline shell (optional) |
