# PersonaLearn

AI-powered co-pilot for Kenyan CBC educators. Next.js + Supabase MVP.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **State:** Zustand (`activeClass`) + TanStack Query
- **Backend:** Supabase (Postgres, Auth, Storage, pgvector)
- **Hosting:** Vercel

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Next.js reads **`.env.local`** for local development (not `.env.example`).

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL from Supabase → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **anon / publishable** key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only; never use in middleware or client)

Restart the dev server after changing env files.

### Vercel preview / production

In **Vercel → Project Settings → Environment Variables**, add the same Supabase vars for **Preview** and **Production**:

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes* | *Or `NEXT_PUBLIC_PUBLISHABLE_KEY` (same anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Eval / cron | Server-only; Gemini Batch poll + live evaluate |
| `CRON_SECRET` | Production | Auth for `/api/cron/eval-batch-poll` (GitHub Actions + manual) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Eval / AI | Gemini vision + Batch API |
| `EVAL_VISION_MODEL` | Optional | Override vision model (ADR-005; default Flash Lite) |
| `EVAL_VISION_ESCALATION` | Optional | Set `1` to enable low-confidence vision escalation |

Missing Preview vars cause `MIDDLEWARE_INVOCATION_FAILED` on PR deployments. **Redeploy** after saving env changes. Use `GET /api/health` to verify Supabase and eval env diagnostics on a deployment.

**Eval batch poll (Hobby-safe):** do not put minute crons in `vercel.json`. Unattended advance uses [`.github/workflows/eval-batch-poll.yml`](.github/workflows/eval-batch-poll.yml) every **5 minutes** (GitHub Actions schedule floor). Open evaluation sessions also call teacher `POST /api/evaluation-batches/[batchId]/poll` (~12s). Add repo secrets:

| Secret | Value |
|--------|--------|
| `EVAL_APP_URL_PROD` (or `EVAL_APP_URL`) | Production origin, e.g. `https://personalearn.vercel.app` |
| `CRON_SECRET` | Same as Vercel `CRON_SECRET` |

Schedules run from the default branch (`main`) after merge; use **Actions → Eval batch poll → Run workflow** to test sooner.

### 3. Set up Supabase

Dev and production are **separate** projects ([PSL-40](https://nervustechnologies.atlassian.net/browse/PSL-40)). Local and Vercel Preview use **dev**; Vercel Production uses **prod**. Full checklist: [docs/production-deploy-checklist.md](docs/production-deploy-checklist.md).

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in `supabase/migrations/` via the SQL Editor (at minimum `20260621_init_schema.sql`; for evaluation, also `20260802_eval_direct_multimodal.sql` — ADR-005 direct multimodal pipeline)
3. **Auth (PSL-18):** Enable Google OAuth under Authentication → Providers
4. Set Site URL and redirect URLs in **Supabase** (Authentication → URL Configuration). Dev project example:
   - Site URL: `https://personalearndev.vercel.app`
   - Redirect URLs (wildcards must include query strings — see [Supabase Vercel guide](https://supabase.com/docs/guides/auth/redirect-urls#vercel-preview-urls)):
     - `http://localhost:3000/**`
     - `https://personalearndev.vercel.app/**`
     - `https://*-.vercel.app/**`
5. Prod project (`personalearn-prod` / `ecwivelanrcjdgkyvbos`): Site URL `https://personalearn.vercel.app`, redirect `https://personalearn.vercel.app/**`
6. In **Google Cloud Console** (APIs & Services → Credentials → OAuth 2.0 Client), set **Authorized redirect URIs** to your Supabase callback — **not** `localhost`:
   - Dev: `https://wrxnkipfmpxcouwtncvq.supabase.co/auth/v1/callback`
   - Prod: `https://ecwivelanrcjdgkyvbos.supabase.co/auth/v1/callback`
   - Copy the same Client ID and Client Secret into Supabase → Authentication → Providers → Google
7. Confirm `handle_new_user` trigger is active (included in migration)

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── (auth)/login/       # Auth pages (Sprint 1)
│   ├── (dashboard)/        # Protected app shell
│   ├── api/                # API routes
│   └── auth/callback/      # OAuth callback
├── components/
│   ├── layout/             # AppShell, ClassSelector
│   └── ui/                 # shadcn-style primitives
├── lib/
│   ├── supabase/           # Browser + server clients
│   ├── store/              # Zustand stores
│   └── providers.tsx       # TanStack Query
└── types/                  # Shared TypeScript types
supabase/migrations/        # Database schema + RLS
```

## Sprint status

- **Sprint 0 (PSL-25):** Project infrastructure — scaffold, schema, middleware, CI (complete)
- **Sprint 1:** Auth, onboarding, dashboard, class management
- **Sprint 2 (PSL-2):** RAG vertical slice — Voyage embeddings, TXT upload + ingest, co-pilot Q&A (complete)
- **Sprint 3 (PSL-3):** AI Hub v2 — chat + history + agent (query, generate, save on confirm) (complete)
- **Sprint 4 (PSL-43):** Class resources section — upload any file type, unified list with agent-saved materials (in review)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm start` | Start production server |

## License

Private — Nervus Technologies
