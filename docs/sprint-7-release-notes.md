# Sprint 7 — Release Notes

**Sprint goal:** Unblock production publishing by fixing critical AI Hub, evaluation, and onboarding bugs.

**Retro:** [docs/retrospective-sprint-7.md](./retrospective-sprint-7.md)

**Confluence:** [Sprint 7 — Release Notes](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/23461889) · [Retrospective: PSL Sprint 7](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/23494657)

**Window:** 2026-08-15 → 2026-08-21 · **GitHub milestone:** [Sprint 7](https://github.com/nervustech/personalearn/milestone/8) · **Release:** [v1.0.2](https://github.com/nervustech/personalearn/releases/tag/v1.0.2)

**Hot-fix already on `main`:** [v1.0.1](https://github.com/nervustech/personalearn/releases/tag/v1.0.1) (PSL-102, 2026-08-16)

## Shipped (merged to `develop`, then `main` as `v1.0.2`)

| Jira | Summary | PR |
|------|---------|-----|
| [PSL-102](https://nervustechnologies.atlassian.net/browse/PSL-102) | Prod AI Hub returns no response (misconfig diagnostics) | [#116](https://github.com/nervustech/personalearn/pull/116) / promote [#117](https://github.com/nervustech/personalearn/pull/117) → `v1.0.1` |
| [PSL-109](https://nervustechnologies.atlassian.net/browse/PSL-109) | SDLC: require Jira team, points, dates, and priority | [#115](https://github.com/nervustech/personalearn/pull/115) |
| [PSL-106](https://nervustechnologies.atlassian.net/browse/PSL-106) | Reuse inflight eval jobs instead of duplicating batches | [#118](https://github.com/nervustech/personalearn/pull/118) |
| [PSL-108](https://nervustechnologies.atlassian.net/browse/PSL-108) | Auto-proceed eval identity on roster match | [#119](https://github.com/nervustech/personalearn/pull/119) |
| [PSL-103](https://nervustechnologies.atlassian.net/browse/PSL-103) | Restore AI Hub file attachments | [#120](https://github.com/nervustech/personalearn/pull/120) |
| [PSL-104](https://nervustechnologies.atlassian.net/browse/PSL-104) | Show stored AI Hub drafts in chat | [#121](https://github.com/nervustech/personalearn/pull/121) |
| [PSL-101](https://nervustechnologies.atlassian.net/browse/PSL-101) | No-class teachers: landing → onboarding/class create | [#123](https://github.com/nervustech/personalearn/pull/123) |
| [PSL-107](https://nervustechnologies.atlassian.net/browse/PSL-107) | Persist welcome tour on the teacher profile | [#125](https://github.com/nervustech/personalearn/pull/125) |
| [PSL-99](https://nervustechnologies.atlassian.net/browse/PSL-99) | Keep landing theme picker on-screen and clickable | [#126](https://github.com/nervustech/personalearn/pull/126) |
| [PSL-105](https://nervustechnologies.atlassian.net/browse/PSL-105) | Navigate directly to resource from dashboard | [#127](https://github.com/nervustech/personalearn/pull/127) |
| [PSL-100](https://nervustechnologies.atlassian.net/browse/PSL-100) | Keep onboarding theme picker in header flow | [#128](https://github.com/nervustech/personalearn/pull/128) |
| [PSL-110](https://nervustechnologies.atlassian.net/browse/PSL-110) | Restore AI Hub streaming and polish thinking UX | [#130](https://github.com/nervustech/personalearn/pull/130) |

PSL-101 first landed on `main` via [#122](https://github.com/nervustech/personalearn/pull/122) and was reverted in [#124](https://github.com/nervustech/personalearn/pull/124); the corrected path is #123 on `develop`.

## Capabilities delivered

1. **AI Hub (production)** — Surface misconfiguration instead of a silent empty chat (`v1.0.1`). Restore composer file attachments, show generated drafts in the thread, restore token streaming, and polish thinking UX.
2. **Evaluation** — Reuse an inflight batch for the same assessment instead of spawning duplicates. Skip identity confirm when admission numbers already match the roster.
3. **Onboarding / auth** — Signed-in teachers with no class go to class create. Welcome tour completion persists on the teacher profile. Theme pickers stay in the header (landing + onboarding) and remain on-screen.
4. **Dashboard** — Recent-resource links open the resource itself, not the class page first.
5. **SDLC** — Jira tickets require Team, story points, start/due dates, and priority before sprint work.

## Production

Promote `develop` → `main` as a **merge commit** (do not squash; do not delete `develop`). Tag **`v1.0.2`**. Vercel Production tracks `main`. No new Supabase migrations in this sprint.

## Manual QA

1. Sign in on production (`https://personalearn.vercel.app`).
2. **No class:** Open dashboard from landing → class-create onboarding. Theme picker stays in the header and on-screen.
3. **Returning teacher:** Welcome tour does not replay after completion.
4. **AI Hub:** Chat streams; attachments send; generated drafts appear in the thread without a print-only path. A missing API key shows a diagnostic, not a blank panel.
5. **Eval:** Upload a roster-matched stack once — identity auto-proceeds; Proceed/re-grade does not create a second batch for the same assessment.
6. **Home:** A recent resource opens the resource page directly.
7. `GET /api/health` → `status: ok` against prod Supabase (`ecwivelanrcjdgkyvbos`).

## Deferred (unchanged from Sprint 6)

| Item | Ticket | Notes |
|------|--------|-------|
| Bounding boxes / pixel crops | [PSL-88](https://nervustechnologies.atlassian.net/browse/PSL-88) | Backlog |
| Simple report export | [PSL-10](https://nervustechnologies.atlassian.net/browse/PSL-10) | Backlog |
| PWA offline shell | [PSL-39](https://nervustechnologies.atlassian.net/browse/PSL-39) | Backlog |
