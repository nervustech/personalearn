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

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/20260621_init_schema.sql` via the SQL Editor
3. Enable Google OAuth under Authentication → Providers
4. Set Site URL and redirect URLs:
   - `http://localhost:3000/auth/callback`
   - Your Vercel preview/production URLs

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

- **Sprint 0 (PSL-25):** Project infrastructure — scaffold, schema, middleware, CI
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
