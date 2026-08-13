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
11. Apply GitHub labels matching Jira:

```bash
gh pr edit <number> --add-label area-<x>,type-<y>
gh pr edit <number> --milestone "Sprint 2"   # when in current sprint
```

12. Sync labels on Jira if missing (`editJiraIssue` → `labels` field).
13. `transitionJiraIssue` → **Review**.
14. Jira comment:

```text
PSL-N — PR opened: {pr-url}
Preview: {vercel-preview-url}
Labels: area-<x>, type-<y>
```

15. Post to Slack `#personalearn-dev` (`C0BDURJTXR8`):

```text
PSL-N — PR opened: {pr-url} — {one-line summary}
```

## Review (before merge)

16. Babysit CI until green (`gh pr checks`).
17. **Verify labels** — Jira ticket and PR must have the same `area-*` + `type-*`. Fix mismatches before reviewing.
18. Post GitHub review (`gh pr review` or review comment). Body must include:

```text
PSL-N — {Approve | Request changes | Comment}

Labels: area-<x>, type-<y> — match Jira

{findings}
```

19. Mirror verdict on Jira:

```text
PSL-N — PR reviewed: {Approve | Changes requested}
{pr-url}
{brief findings}
Labels confirmed: area-<x>, type-<y>
```

20. If review surfaces follow-up debt, add `type-tech-debt` on a **new** triaged ticket — do not expand scope on the current PR.

## Merge (human gate)

21. **Stop** — ask user for merge approval unless they already requested merge.
22. `gh pr merge --squash --delete-branch`.
23. `transitionJiraIssue` → **Done**.
24. Jira comment:

```text
PSL-N — merged to develop: {pr-url}
```

25. Slack:

```text
PSL-N — merged: {pr-url} — {one-line summary}
```

## GitHub Issue intake (bugs / feature requests)

When triaging a GitHub Issue before a Jira ticket exists:

1. Apply `needs-triage` + best-guess `type-*` on the issue.
2. Use `triage-issue` skill to find duplicates and create/link `PSL-N`.
3. Copy `area-*` + `type-*` to the Jira ticket; remove `needs-triage` from issue when triaged.
4. Reply on the issue with `PSL-N` link and labels applied.

## Checklist

```
- [ ] Jira pre-flight (ACs, blocks, labels)
- [ ] Branch + In Progress + Jira comment
- [ ] PR open with PSL-N in title
- [ ] area-* + type-* on PR and Jira (synced)
- [ ] Jira → Review + PR/preview comment
- [ ] CI green
- [ ] GitHub review with verdict + label check
- [ ] Matching Jira review comment
- [ ] User approved merge
- [ ] Done + Jira merge comment + Slack
```
