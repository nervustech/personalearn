# Retrospective: Sprint 5

**Epic:** [PSL-3 — v1.0 Program: Agent-centric MVP](https://nervustechnologies.atlassian.net/browse/PSL-3)  
**Sprint window:** 2026-07-09 → 2026-07-17 (bulk eval + student bridge merged to `develop`)  
**Release notes:** [docs/sprint-5-release-notes.md](./sprint-5-release-notes.md)  
**Umbrella:** [PSL-8](https://nervustechnologies.atlassian.net/browse/PSL-8)  
**Confluence:** [Sprint 5 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/13205505) · [Retrospective: PSL Sprint 5](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/13172737)

## Sprint goal

Teachers can bulk- or single-upload pen-and-paper scripts, group by admission number (Gemini vision), draft per-question marks against a marking scheme, review/re-evaluate, and sign off — then see results on the student profile and dashboard. Gradable materials saved from chat are visible on student profiles as soon as they hit the class library.

**Shipped stack (merge order):** PSL-44 → PSL-50/51 → PSL-45 → PSL-46 → PSL-47 → PSL-52/54/53 → PSL-48 → PSL-38 (PRs #34–#44)

## Keep doing

- One ticket → one branch → one PR, merged sequentially with rebase after squash merges
- Split large epics into review-gated delivery stories (PSL-8 children) instead of mega-PRs
- Multi-commit-by-AC on feature branches for reviewable history ([PSL-51](https://nervustechnologies.atlassian.net/browse/PSL-51))
- Phase 0 / ADR decisions before identity work; defer expensive labs when teacher review is already the quality gate ([PSL-50](https://nervustechnologies.atlassian.net/browse/PSL-50))
- Colocated unit and API route tests in the same PR as the feature
- `docs/` mirrors for Confluence publishing at sprint close
- Human-in-the-loop writes: amber identity confirm; sign-off as the persist gate for results

## Start doing

- Publish Confluence release notes + retro on the same day the last sprint ticket merges
- Close the umbrella ticket (PSL-8) when all children are Done — do not leave it hanging in To Do
- Apply the full Sprint 5 migration chain on every preview environment before end-to-end QA
- Capture real/pilot handwriting samples early so vision tier tuning is evidence-based (not synthetic-only)

## Stop doing

- Treating umbrella stories as implementable tickets (PSL-8 was tracking-only)
- Blocking product delivery on pre-implementation accuracy labs when the UX already requires teacher confirm
- Shipping review UX in one pass — iterate (PSL-47 → PSL-52 → PSL-53) was the right call; plan polish tickets earlier next time

## What went well

- Full vertical slice landed: schema → identity → drafts → review → profile → dashboard
- Lite-first vision + amber confirm unblocked PSL-45 without waiting on a Flash/Pro lab
- Gradable save → assessment bridge made single-student eval possible without a class-wide batch
- Review workspace polish (split-pane, A4, auto-draft) and math Markdown improved teacher trust in drafts
- Focused PRs (#34–#44) stayed mergeable; CI stayed green through the stack

## What could improve

- Vision accuracy on messy classroom handwriting is still unproven at scale — needs pilot pages
- Flash/Pro auto-escalation remains deferred; escape hatch (`EVAL_VISION_MODEL`) exists but is unused in prod paths
- End-to-end manual QA script is long; consider a short smoke checklist vs full AC walkthrough for future sprints
- Umbrella PSL-8 stayed To Do until closeout — process gap

## Action items

- [x] Ship Sprint 5 delivery stack under PSL-8 (PSL-44 → PSL-48 + PSL-38; polish PSL-52–54)
- [x] Publish Sprint 5 release notes + retrospective (repo + Confluence)
- [x] Close PSL-8 umbrella (Done)
- [ ] Complete Jira board: PSL Sprint 5 (sprint id 71)
- [ ] Kick off Sprint 6: [PSL-10](https://nervustechnologies.atlassian.net/browse/PSL-10) / [PSL-40](https://nervustechnologies.atlassian.net/browse/PSL-40) / [PSL-41](https://nervustechnologies.atlassian.net/browse/PSL-41) — export + production launch
- [ ] Confirm all `20260709`–`20260716` migrations applied on preview Supabase
- [ ] Collect pilot handwriting samples for vision tier revisit (ADR-003 contingency)

## Deferred to later sprints

| Sprint | Ticket | Capability |
|--------|--------|------------|
| 6 | PSL-10 | Simple report export |
| 6 | PSL-39 | PWA offline shell (optional) |
| 6 | PSL-40 | Production Supabase |
| 6 | PSL-41 | Production deploy + `v1.0.0` |
| Later | — | Flash/Pro vision auto-escalation; term analytics; non-image scans |
