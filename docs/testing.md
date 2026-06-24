# PersonaLearn Testing Guide

This document describes how we test PersonaLearn, what each layer covers, and how to run tests locally and in CI.

## Toolchain

| Layer | Tool |
|-------|------|
| Unit + integration | [Vitest](https://vitest.dev/) |
| React components (future) | Vitest + [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) |
| End-to-end | [Playwright](https://playwright.dev/) |

## Test pyramid

```
E2E (Playwright)     — few journeys, highest confidence
Integration (Vitest) — middleware, auth helpers with mocks
Unit (Vitest)        — Zod schemas, parsers, pure functions
```

## What we protect (priority)

| Priority | Area | Test type |
|----------|------|-----------|
| P0 | Auth gate + onboarding redirects | Middleware integration + E2E auth gate |
| P0 | Class creation / onboarding | E2E onboarding (with credentials) + `classSchema` unit tests |
| P1 | Student roster + CSV import | `parseStudentRows` unit tests |
| P1 | Form validations | Zod unit tests in `src/lib/validations/` |
| P2 | Welcome tour, class selector | Manual QA for now |

## E2E authentication strategy

**Decision:** use a **dedicated Supabase staging project** with email/password auth — not `supabase start` in CI (heavier to maintain) and not real Google OAuth in automation.

1. Create a separate Supabase project for staging/E2E (never production).
2. Disable email confirmation for test accounts (Authentication → Providers → Email).
3. Create a test teacher account (or one without classes for onboarding flows).
4. Set in `.env.local` (local only — do not commit):

```bash
E2E_TEST_EMAIL=teacher-e2e@your-staging-project.test
E2E_TEST_PASSWORD=your-secure-test-password
```

**CI behavior:**

- `npm test` (unit + integration) runs on every PR — no Supabase network required (mocks only).
- `e2e/auth-gate.spec.ts` runs without credentials (redirect smoke test).
- `e2e/onboarding.spec.ts` is **skipped** in CI until `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` GitHub Actions secrets are configured.

To enable authenticated E2E in CI later, add repository secrets and a separate workflow job with `npx playwright install --with-deps chromium`.

## Running tests locally

### Unit and integration

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Test files live next to source: `src/**/*.test.ts`.

### End-to-end

```bash
# Optional: set E2E credentials in .env.local or export them
export E2E_TEST_EMAIL=...
export E2E_TEST_PASSWORD=...

npm run test:e2e
```

Playwright starts the dev server automatically (`playwright.config.ts`). To reuse an already-running server, keep `npm run dev` running — Playwright will detect it when not in CI.

### Full pre-PR check

```bash
npm run lint
npm test
npm run build
npm run test:e2e   # optional without E2E credentials (auth-gate only)
```

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on push/PR to `main` and `develop`:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build`

E2E is intentionally not in the default CI job yet — add when staging Supabase secrets are ready.

## Test file map (Sprint 1 backfill)

| File | Covers |
|------|--------|
| `src/lib/auth/post-login-path.test.ts` | Post-login routing helper |
| `src/lib/validations/auth.test.ts` | Login/signup Zod rules |
| `src/lib/validations/class.test.ts` | Class/student Zod rules |
| `src/lib/csv/parse-student-rows.test.ts` | CSV row parsing |
| `src/lib/auth/ensure-user-profile.test.ts` | Profile provisioning |
| `src/middleware.test.ts` | Auth gate + onboarding redirects |
| `e2e/auth-gate.spec.ts` | Unauthenticated dashboard redirect |
| `e2e/onboarding.spec.ts` | Sign-in + class creation (needs credentials) |

## Definition of done (going forward)

For P0/P1 Jira stories, include in acceptance criteria:

> Automated tests added for new behavior; `npm test` passes in CI.

## Branching tests

Branch by **Jira ticket and user value**, not by test type (unit vs E2E).

| Test work | Branch with | Example |
|-----------|-------------|---------|
| Test infrastructure (Vitest, Playwright, CI, docs) | Dedicated chore ticket | `chore/PSL-29-test-foundation` |
| Tests for a new feature | Same feature branch | `feature/PSL-32-rag-pipeline` includes RAG tests |
| Tests for a bug fix | Same fix branch | `fix/PSL-40-login-redirect` includes regression test |
| Backfill tests for merged work | One backfill ticket | `chore/PSL-29-test-foundation` (Sprint 1 retro) |

**Rules:**

- One Jira ticket → one branch → one PR. Tests for that ticket live in the same PR.
- Colocate unit/integration tests next to source (`foo.ts` + `foo.test.ts`). Group E2E by user journey in `e2e/`.
- Do not reopen closed feature tickets just to add tests — use a backfill chore ticket instead.
- From Sprint 2 onward, ship features with their tests; do not defer tests to a separate PR.

**When to split into multiple branches:** only when scope is too large to review (e.g. test infra in PSL-29, then E2E-in-CI as a follow-up chore). Never split by test layer alone.

See also [`.cursor/rules/git-workflow.mdc`](../.cursor/rules/git-workflow.mdc) for branch naming and commit prefixes.

## Manual checklist (not automated)

- Real Google OAuth on staging
- Mobile navigation (hamburger menu)
- PWA install flow (Sprint 3)
