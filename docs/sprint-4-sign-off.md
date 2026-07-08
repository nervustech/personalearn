# Sprint 4 Phase 0 sign-off record

**Approved:** 2026-07-08  
**Ticket:** [PSL-43](https://nervustechnologies.atlassian.net/browse/PSL-43) — Class resources section  
**Spec:** [Confluence v1.0 Program Specs](https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/8388609) · [docs/sprint-3-specs.md](./sprint-3-specs.md) § Sprint 4

## Locked decisions

| Decision | Resolution |
|----------|------------|
| Sprint 4 chat / agent | DeepSeek unchanged (`CHAT_PROVIDER=deepseek`) |
| PDF text extraction | `unpdf` (local, no vision API) |
| Image text extraction (JPEG/PNG) | Gemini 2.5 Flash via `@ai-sdk/google` |
| Vision provider (Sprint 5 preview) | Gemini tiered stack — Flash-Lite → Flash → Pro escalation ([ADR-003](./adr-003-ai-provider-rag.md)) |
| Grok/xAI vision | **Retired** — no API access; replaced by Gemini |
| Max upload size | 5 MB for PDF/images; 2 MB for TXT (or unify at 5 MB at implementation) |
| Gemini billing for dev | **Free tier OK** for local testing and Sprint 4 QA |
| Gemini billing for production | **Paid tier required** (billing-enabled Cloud project) — no training on teacher content |

## Provider keys (Sprint 4)

| Key | Required for Sprint 4? | Notes |
|-----|------------------------|-------|
| `DEEPSEEK_API_KEY` | Yes (existing) | AI Hub chat + agent |
| `VOYAGE_API_KEY` | Yes (existing) | Embeddings after extract |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes (new) | Image upload OCR only |
| `XAI_API_KEY` | No | Optional chat fallback only; not used for vision |

## Free tier vs paid (Gemini)

- **Testing / development:** Use Gemini **free tier** — no purchase required. Get a key at [Google AI Studio](https://aistudio.google.com/). Rate limits apply; Google may use free-tier data for product improvement — fine for synthetic or non-sensitive test uploads.
- **Production / pilot with real teacher content:** Enable **billing** on the Google Cloud project linked to the API key. Paid tier stops Google from using prompts for model training. Cost at early scale is pennies to a few dollars per month for image OCR.
- **No upfront credits purchase:** Pay-as-you-go after billing is enabled; free tier has no credit card requirement.

## Design review (AC traceability)

Manual QA script from spec — verified testable before implementation:

1. Upload PDF scheme → indexed and listed (AC-4.2)
2. Upload image → Gemini extraction + listed (AC-4.2)
3. Open resource; delete another with confirmation (AC-4.3, AC-4.4)
4. AI Hub-saved resource appears with AI-generated indicator (AC-4.5)
5. Non-owner resources API → 403 (AC-4.6)

## Jira actions (paste if MCP comment blocked)

Post on PSL-43:

```text
PSL-43 — Sprint 4 requirements signed off (Phase 0)
Spec: https://nervustechnologies.atlassian.net/wiki/spaces/PLEARN/pages/8388609
Vision: Gemini 2.5 Flash for image OCR; PDF via unpdf; chat stays DeepSeek
ADR-003 updated (Grok vision retired)
Approved: 2026-07-08
```
