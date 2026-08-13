# Sprint 4 — Release Notes

**Sprint goal:** Class resources section — upload, list, open, and delete materials per class; unified view of uploaded and AI-generated resources ([PSL-43](https://nervustechnologies.atlassian.net/browse/PSL-43)).

**Spec:** [docs/sprint-3-specs.md](./sprint-3-specs.md) § Sprint 4 · **Sign-off:** [docs/sprint-4-sign-off.md](./sprint-4-sign-off.md)

## Shipped (this PR)

| Jira | Summary | Key paths |
|------|---------|-----------|
| PSL-43 | Class resources section — multi-format upload + unified list | `/classes/[classId]`, `/api/resources`, `/api/resources/ingest`, `/api/resources/[resourceId]`, `src/components/classes/class-resources-section.tsx`, `src/lib/ai/extract-text.ts`, `src/lib/ai/vision-model.ts` |

## Capabilities delivered

1. **Resources list (AC-4.1, AC-4.5)** — Class page shows all active resources with title, type, source (uploaded vs AI-generated), and date.
2. **Multi-format upload (AC-4.2)** — TXT (2 MB), PDF and images (5 MB) via extended ingest; PDF via `unpdf`, images via Gemini 2.5 Flash OCR.
3. **Open + download (AC-4.3)** — View extracted text in a dialog; download original file via signed storage URL.
4. **Delete with confirmation (AC-4.4)** — Removes storage object, `resources` row, and cascading `resource_chunks`.
5. **Authorization (AC-4.6)** — All resources APIs enforce class ownership via `requireTeacherClass` / `requireTeacherResource`.

## Environment

Add to `.env.local` / Vercel:

- `GOOGLE_GENERATIVE_AI_API_KEY` — image OCR (Gemini Flash); free tier OK for dev/QA
- Existing: `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`, Supabase keys

## Manual QA

1. Open a class → upload a PDF scheme → confirm indexed and listed.
2. Upload a JPEG/PNG image → confirm Gemini extraction + listing.
3. Open a resource; delete another with browser confirmation.
4. Save a resource from AI Hub → confirm it appears with AI-generated badge.

## Deferred to Sprint 5+

| Item | Ticket |
|------|--------|
| Bulk evaluation workflow | PSL-8 |
| Dashboard competency snapshot | PSL-38 |
| Production launch + `v1.0.0` | PSL-40, PSL-41 |
