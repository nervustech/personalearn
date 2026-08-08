import { z } from "zod";

export const indexResultSchema = z.object({
  admission_number: z.string().nullable(),
  admission_confidence: z.number().min(0).max(1),
  page_number: z.number().int().positive().nullable(),
  total_pages: z.number().int().positive().nullable(),
  questions_found: z.array(z.string()),
});

export type IndexResult = z.infer<typeof indexResultSchema>;

/** Gemini responseSchema for structured index output. */
export const indexGeminiSchema = {
  type: "OBJECT",
  properties: {
    admission_number: { type: "STRING", nullable: true },
    admission_confidence: { type: "NUMBER" },
    page_number: { type: "INTEGER", nullable: true },
    total_pages: { type: "INTEGER", nullable: true },
    questions_found: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: ["admission_confidence", "questions_found"],
} as const;

/** OpenAPI-style JSON Schema for xAI structured outputs. */
export const indexJsonSchema = {
  type: "object",
  properties: {
    admission_number: { type: ["string", "null"] },
    admission_confidence: { type: "number" },
    page_number: { type: ["integer", "null"] },
    total_pages: { type: ["integer", "null"] },
    questions_found: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["admission_confidence", "questions_found"],
  additionalProperties: false,
} as const;

/** Stable system prompt — kept identical across pages for xAI prompt-cache hits. */
export function buildIndexPrompt(): string {
  return `You are indexing a scanned student answer sheet page.

Extract ONLY header metadata — do not grade or transcribe full answers.

Return JSON with:
- admission_number: student admission/registration number written on the page (null if missing/illegible)
- admission_confidence: 0–1 confidence in the admission number read
- page_number: page number if written (null if absent)
- total_pages: total pages if written (null if absent)
- questions_found: question labels visible on this page. Prefer section-qualified labels when sections exist (e.g. "A.1", "A.2", "B.1"). Use bare labels ("1", "2a") only for a single continuous sequence. If numbering restarts without a section header, still list each occurrence in order (duplicates allowed) — do not drop later sections.

Be conservative: low confidence when handwriting is unclear.`;
}

export function buildIndexUserPrompt(): string {
  return "Index the attached page image. Return JSON only.";
}

export function parseIndexResult(raw: unknown): IndexResult {
  return indexResultSchema.parse(raw);
}
