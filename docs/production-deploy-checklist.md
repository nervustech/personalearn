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
| AI keys (`VOYAGE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `XAI_API_KEY`, …) | Same providers as Preview, Production scope |

After saving `NEXT_PUBLIC_*` vars, **redeploy** Production. Check `GET /api/health`.

GitHub Actions eval poll (after `develop` → `main`): repo secret `EVAL_APP_URL=https://personalearn.vercel.app`.

## RLS smoke

1. Sign up a **new** teacher on production (do not reuse a dev account).
2. Confirm `public.users` row exists (trigger).
3. Create a class; confirm it is visible only to that teacher.
4. A second teacher must not see the first teacher's classes or storage objects.

SQL-level isolation was verified on prod during PSL-40 (two synthetic teachers, class insert + cross-tenant SELECT/INSERT blocked). Repeat in the UI after Site URL is confirmed.

## Promote (PSL-41)

1. Confirm this checklist.
2. Set Vercel Production env to **prod** Supabase.
3. Merge `develop` → `main`, tag `v1.0.0`.
