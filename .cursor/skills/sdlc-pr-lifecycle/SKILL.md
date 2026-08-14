---
name: sdlc-pr-lifecycle
description: >-
  Run the PersonaLearn delivery loop from Jira ticket through branch, PR, labels,
  review comments, Jira sync, merge, and Slack notification. Use when implementing
  PSL-N, opening or reviewing a PR, syncing labels between Jira and GitHub, posting
  cross-system comments, or merging ticketed work.
---

# SDLC PR lifecycle (PersonaLearn)

Follow `git-workflow.mdc` and `sdlc-ecosystem.mdc` for constraints. This skill is the **procedure**.

## Pre-flight

1. `getJiraIssue(PSL-N)` — read summary, ACs, labels, sprint, blockers, linked spec.
2. Abort if **blocks** prerequisites are not **Done** (unless user overrides).
3. Confirm ticket is in sprint or explicitly prioritized.

## Branch and start

4. Fetch `origin/develop`; branch `{feature|fix|chore|docs}/PSL-N-short-description`.
5. `transitionJiraIssue` → **In Progress**.
6. `addCommentToJiraIssue`:

```text
PSL-N — branch created: {branch-name}
```

## Implement

7. Code and test. Commit **only when the user asks** (see user commit rule). When committing, prefer **multiple focused commits** aligned to ACs or coherent green slices — not one mega-commit at ticket end (see `git-workflow.mdc`). Squash merge still yields one commit on `develop`.
8. Keep diff scoped to one ticket.

## Open PR

9. Rebase onto `origin/develop` before push.
10. Push branch; open PR targeting `develop` via `gh pr create` (title includes `PSL-N`).
11. Apply GitHub labels and metadata matching Jira:

```bash
gh pr edit <number> --add-label area-<x>,type-<y>
gh pr edit <number> --add-assignee nervustech
gh pr edit <number> --milestone "Sprint 6"   # current sprint, or Backlog
gh pr edit <number> --add-reviewer <collaborator>  # skip if solo-dev / self
```

12. Sync labels + assignee on Jira if missing (`editJiraIssue`).
13. `transitionJiraIssue` → **Review**.
14. Jira comment:

```text
PSL-N — PR opened: {pr-url}
Preview: {vercel-preview-url}
Labels: area-<x>, type-<y>
Assignee: nervustech
Milestone: {sprint or Backlog}
```

15. Post to Slack `#personalearn-dev` (`C0BDURJTXR8`):

```text
PSL-N — PR opened: {pr-url} — {one-line summary}
```

## Review (before merge)

16. Babysit CI until green (`gh pr checks`).
17. **Verify labels + metadata + Test plan** — Jira ticket and PR must have the same `area-*` + `type-*`. PR must have **assignee**, **sprint milestone** (or Backlog), and a **requested reviewer** (or a posted solo-dev review comment). Run the PR **Test plan** (lint/test/build/manual/preview as listed). Edit the PR body so every item is `[x]`, or `[ ]` with **N/A — {reason}**. Do **not** Approve or ask to merge while any item is still an unchecked `[ ]`.
18. Post GitHub review (`gh pr review` or review comment). Body must include:

```text
PSL-N — {Approve | Request changes | Comment}

Labels: area-<x>, type-<y> — match Jira
Assignee + milestone confirmed
Test plan: all items [x] (or N/A with reason)

{findings}
```

19. Mirror verdict on Jira:

```text
PSL-N — PR reviewed: {Approve | Changes requested}
{pr-url}
{brief findings}
Labels confirmed: area-<x>, type-<y>
Assignee + milestone confirmed
Test plan checked
```

20. If review surfaces follow-up debt, add `type-tech-debt` on a **new** triaged ticket — do not expand scope on the current PR.

## Merge (human gate)

21. **Stop** — ask user for merge approval unless they already requested merge. Abort merge if any Test plan item is still `[ ]` without an N/A reason.
22. `gh pr merge --squash --delete-branch`.
23. Close the linked GitHub Issue: `gh issue close <n> --reason completed`.
24. `transitionJiraIssue` → **Done**.
25. Jira comment:

```text
PSL-N — merged to develop: {pr-url}
GitHub Issue closed: {issue-url}
```

26. Slack:

```text
PSL-N — merged: {pr-url} — {one-line summary}
```

## GitHub Issue intake (bugs / feature requests)

When triaging a GitHub Issue before a Jira ticket exists:

1. Apply `needs-triage` + best-guess `type-*` (+ `area-*` when known). Assign `nervustech`. Set milestone to the current sprint or `Backlog`.
2. Use `triage-issue` skill to find duplicates and create/link `PSL-N`.
3. Copy `area-*` + `type-*` + assignee to the Jira ticket; remove `needs-triage` from the issue when triaged.
4. Reply on the issue with `PSL-N` link, labels, assignee, and milestone applied.

## Checklist

```
- [ ] Jira pre-flight (ACs, blocks, labels, assignee)
- [ ] Branch + In Progress + Jira comment
- [ ] PR open with PSL-N in title
- [ ] area-* + type-* on PR and Jira (synced); assignee + milestone
- [ ] Reviewer requested (or solo-dev review comment)
- [ ] Jira → Review + PR/preview comment
- [ ] CI green
- [ ] GitHub review with verdict + label/assignee/milestone check
- [ ] PR Test plan boxes checked (`[x]` or N/A + reason)
- [ ] Matching Jira review comment
- [ ] User approved merge
- [ ] GitHub Issue closed as completed
- [ ] Done + Jira merge comment + Slack
```
