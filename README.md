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
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes | Never expose to middleware or client |

Missing Preview vars cause `MIDDLEWARE_INVOCATION_FAILED` on PR deployments. **Redeploy** after saving env changes.

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/20260621_init_schema.sql` via the SQL Editor
3. **Auth (PSL-18):** Enable Google OAuth under Authentication → Providers
4. Set Site URL and redirect URLs in **Supabase** (Authentication → URL Configuration). Dev project example:
   - Site URL: `https://personalearndev.vercel.app`
   - Redirect URLs (wildcards must include query strings — see [Supabase Vercel guide](https://supabase.com/docs/guides/auth/redirect-urls#vercel-preview-urls)):
     - `http://localhost:3000/**`
     - `https://personalearndev.vercel.app/**`
     - `https://*-.vercel.app/**`
5. Prod Supabase: Site URL `https://personalearn.vercel.app`, redirect `https://personalearn.vercel.app/**`
6. In **Google Cloud Console** (APIs & Services → Credentials → OAuth 2.0 Client), set **Authorized redirect URIs** to your Supabase callback — **not** `localhost`:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
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
- **Sprint 2:** RAG, AI generation, co-pilot, multimodal feedback
- **Sprint 3:** Progress tracking, exports, PWA, production deploy

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm start` | Start production server |

## License

Private — Nervus Technologies
