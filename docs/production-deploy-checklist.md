# Production deploy checklist

Covers [PSL-40](https://nervustechnologies.atlassian.net/browse/PSL-40) (dedicated production Supabase) and the env/auth steps [PSL-41](https://nervustechnologies.atlassian.net/browse/PSL-41) needs before tagging `v1.0.0`.

**Never commit secrets.** Copy keys from the Supabase dashboard into Vercel only.

## Projects (do not share)

| Env | Dashboard name | Project ref | API URL |
|-----|----------------|-------------|---------|
| Dev (local + Vercel Preview) | `personalearn-dev` | `wrxnkipfmpxcouwtncvq` | `https://wrxnkipfmpxcouwtncvq.supabase.co` |
| Production | `personalearn-prod` | `ecwivelanrcjdgkyvbos` | `https://ecwivelanrcjdgkyvbos.supabase.co` |

Local `.env.local` must keep pointing at **dev**. Production keys belong only in Vercel **Production** scope.

## Schema (PSL-40)

Apply the committed files in `supabase/migrations/` on the **prod** project (SQL Editor or Management API). Skip untracked ADR-004 leftovers (`20260727_evaluation_jobs.sql`, `20260728_page_parses_realtime.sql`) — those tables were dropped by ADR-005.

Do **not** `supabase db push` blindly to prod: CLI filename versions differ from history already applied on the restored project, and untracked local SQL would get pushed.

Expected after apply:

- Public tables include eval pipeline: `evaluation_batches`, `evaluated_scripts`, `evaluation_pages`, `question_evaluations`, `gemini_batch_jobs`
- Storage buckets (private): `resources`, `student_submissions`
- RLS enabled on all public tables; realtime publication includes `evaluated_scripts`
- `evaluation_batches.status` allows `draft | processing | in_review | signed_off`
- `handle_new_user` trigger on `auth.users`

## Auth (match dev)

In **prod** Supabase → Authentication:

1. Providers: **Email** and **Google** enabled (same as dev).
2. URL Configuration:
   - Site URL: `https://personalearn.vercel.app`
   - Redirect URLs: `https://personalearn.vercel.app/**`
3. Google Cloud Console → OAuth 2.0 client → Authorized redirect URIs must include the **prod** callback (not localhost):
   - `https://ecwivelanrcjdgkyvbos.supabase.co/auth/v1/callback`
   - Keep the existing **dev** callback on the same client if you share credentials:
     `https://wrxnkipfmpxcouwtncvq.supabase.co/auth/v1/callback`

Email confirmation can stay on for production. A first teacher account is easiest via **Google**, or confirm the email if using password signup.

## Vercel Production env (names only)

Project Settings → Environment Variables → **Production** (not Preview). Preview stays on the **dev** project.

| Variable | Where to copy the value |
|----------|-------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_PUBLISHABLE_KEY`) | Prod anon / publishable key |
| `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` (middleware fallback) |
| `SUPABASE_ANON_KEY` | Same as anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod **service_role** (server-only; never client or git) |
| `CRON_SECRET` | Same secret as GitHub Actions `CRON_SECRET` |
| AI keys (`VOYAGE_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, optional `XAI_API_KEY`) | Same providers as Preview, Production scope |
| `CHAT_PROVIDER` | Usually `deepseek` (default). Use `xai` only if `XAI_API_KEY` is set for chat |

After saving `NEXT_PUBLIC_*` vars, **redeploy** Production. Check `GET /api/health`.

GitHub Actions eval poll (after `develop` → `main`): repo secret `EVAL_APP_URL_PROD` or `EVAL_APP_URL` = `https://personalearn.vercel.app`. `CRON_SECRET` must match Vercel Production.

## RLS smoke

1. Sign up a **new** teacher on production (do not reuse a dev account).
2. Confirm `public.users` row exists (trigger).
3. Create a class; confirm it is visible only to that teacher.
4. A second teacher must not see the first teacher's classes or storage objects.

SQL-level isolation was verified on prod during PSL-40 (two synthetic teachers, class insert + cross-tenant SELECT/INSERT blocked). Repeat in the UI after Site URL is confirmed.

## Promote (PSL-41)

`origin/main` is still the initial commit until this promote. `https://personalearn.vercel.app` returning Vercel `NOT_FOUND` is expected until the first Production deployment from `main`. Confirm in Vercel: Production Branch = `main`, domain = `personalearn.vercel.app`.

1. Vercel **Production** env points at `personalearn-prod` (not the shared dev project). Redeploy Production after any `NEXT_PUBLIC_*` change.
2. GitHub repo secrets: `CRON_SECRET` plus `EVAL_APP_URL_PROD` (or `EVAL_APP_URL`) = `https://personalearn.vercel.app`.
3. Open `develop` → `main` PR. Merge only after the regression checklist below passes (human gate).
4. Tag `v1.0.0` on `main`: `git tag -a v1.0.0 <sha> && git push origin v1.0.0`.
5. `GET https://personalearn.vercel.app/api/health` returns `status: ok` and prod Supabase (not the dev ref).
6. Run **Actions → Eval batch poll → Run workflow** once against production.
7. Slack `#personalearn-dev` ship announcement.

PSL-10 (report export) and PSL-39 (PWA) are backlog — not required for `v1.0.0`.

### Regression (production URL)

Run on `https://personalearn.vercel.app` after the first Production deploy:

1. Teacher signs in (Google or email) — new prod account, not a reused dev user.
2. Creates a class; uploads a resource; ingest succeeds.
3. AI Hub: query with citation; generate + save a resource on confirm.
4. Class resources section shows uploaded + AI-generated items.
5. Evaluation: upload stack → review → sign off → results saved.
6. Dashboard shows competency for students in that class.
7. `npm test` + `npm run build` green on the `develop` → `main` PR (CI).

Auth dashboard (if login redirects fail): prod Site URL `https://personalearn.vercel.app`, redirect `https://personalearn.vercel.app/**`, Google callback `https://ecwivelanrcjdgkyvbos.supabase.co/auth/v1/callback`.
