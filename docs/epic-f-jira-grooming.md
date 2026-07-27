# Epic F Jira grooming — ADR-004 re-implementation (2026-07-26)

**Applied via Atlassian MCP** from `personalearn-psl84` worktree (Atlassian plugin is workspace-scoped per Cursor project folder).

## What changed

### Epics A–E → Done
PSL-56…PSL-83 transitioned to **Done** (merged via PRs #88–#92).

### Epic F → reset + re-scope
- PSL-84, PSL-85, PSL-86, PSL-87 reset from stale Review/In Progress → **To Do**
- PSL-88…PSL-93 already To Do; descriptions updated to ADR-004 ACs
- PSL-88, PSL-89: **`deferred-phase-b`** label + deferral comments

### New gap stories
- [PSL-96](https://nervustechnologies.atlassian.net/browse/PSL-96) — Realtime eval progress dots + queue summary (PR-F5)
- [PSL-97](https://nervustechnologies.atlassian.net/browse/PSL-97) — Parse-cache Phase A + text-first grading pilot (PR-F6)

### Parent epic
[PSL-55](https://nervustechnologies.atlassian.net/browse/PSL-55) description updated: A–E Done, F rebuild in progress.

## PR merge order (Epic F)

```
PSL-86 (F1+F2) → PSL-84 (F3) → PSL-91/87/93 (F4) → PSL-96 (F5)
→ PSL-97 (F6) → PSL-92 (F7) → PSL-85 (F8) → PSL-90 (F9)
```

Deferred: PSL-88, PSL-89 (Phase B).

## Spec
[ADR-004 — Evaluation pipeline rehaul](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/14286849/ADR-004+Evaluation+pipeline+rehaul)

## MCP note
Atlassian MCP is scoped per Cursor workspace. Prefer the **`personalearn`** window for Jira/Confluence during Epic F.
