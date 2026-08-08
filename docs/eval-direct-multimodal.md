# Direct multimodal evaluation — implementation reference

Source: Gemini research (`Best Handwritten Text Parsing Engines - Google Gemini.pdf`). Use `@eval-direct-multimodal.md` in Cursor when implementing eval features.

## Flow

```
Upload → evaluation_pages (content_hash dedupe)
  → Phase 1 index (Batch or sync): admission, page_number, questions_found, confidence
  → group-by-admission (amber / unmatched / cleared)
  → Phase 2 evaluate (Batch or sync): all pages + marking scheme → structured JSON
  → question_evaluations rows → split-pane review → sign-off
```

## JSON shapes

### Index (per page)

```json
{
  "admission_number": "ADM-2024-0891",
  "admission_confidence": 0.92,
  "page_number": 1,
  "total_pages": 3,
  "questions_found": ["1", "2"]
}
```

### Evaluate (per student packet)

```json
{
  "total_score_percentage": 78,
  "questions": [
    {
      "question_number": "2",
      "title": "Calculate the area of a circle with radius 7 cm",
      "status": "ATTENTION_NEEDED",
      "page_number": 1,
      "vertical_bounds": { "top_percent": 0.35, "bottom_percent": 0.65 },
      "student_work": { "formula": "Area = 2πr", "answer": "44 cm²" },
      "correct_reference": { "formula": "Area = πr²", "answer": "154 cm²" },
      "explanation": "...",
      "suggested_feedback": "...",
      "awarded": 0,
      "max": 5,
      "confidence": 0.88
    }
  ]
}
```

## Modules

| Module | Role |
|--------|------|
| `index-schema.ts` | Shared Zod + Gemini JSON schema + index prompt |
| `evaluate-schema.ts` | Shared evaluate prompt + schema |
| `sync-client.ts` | Live sync index/evaluate |
| `batch-client.ts` | Gemini Batch submit/poll/results |
| `group-by-admission.ts` | Roster match + amber rules |
| `persist-results.ts` | Model output → DB |
| `poll-batches.ts` | Cron: advance index → evaluate phases |
| `escalate.ts` | Low confidence → Flash/Pro retry |
| `retries.ts` | Bounded backoff |

## Env

- `GOOGLE_GENERATIVE_AI_API_KEY` — required
- `EVAL_VISION_MODEL` — default `gemini-3.1-flash-lite`
- `EVAL_VISION_ESCALATION=1` — enable Flash/Pro retry
- `CRON_SECRET` — auth for `/api/cron/eval-batch-poll` (GitHub Actions every 5m + teacher session poll)

## Status machine

**Script:** `uploaded` → `indexing` → `identity_amber` | `evaluating` → `ready` → `signed_off` (+ `failed`, `unmatched`)

**Session (batch):** rollup from scripts — `draft`, `processing`, `in_review`, `signed_off`
