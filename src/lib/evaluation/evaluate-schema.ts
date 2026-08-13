import { z } from "zod";
import { canonicalizeEvaluateQuestions } from "@/lib/evaluation/question-identity";

export const verticalBoundsSchema = z.object({
  top_percent: z.number().min(0).max(1),
  bottom_percent: z.number().min(0).max(1),
});

export const evaluateQuestionSchema = z.object({
  question_number: z.string(),
  /** Printed section / part label when present (e.g. "A", "Section B"). */
  section: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  status: z.enum(["CORRECT", "ATTENTION_NEEDED"]),
  page_number: z.number().int().positive().nullable().optional(),
  vertical_bounds: verticalBoundsSchema.nullable().optional(),
  student_work: z.record(z.unknown()).nullable().optional(),
  correct_reference: z.record(z.unknown()).nullable().optional(),
  explanation: z.string().nullable().optional(),
  suggested_feedback: z.string().nullable().optional(),
  awarded: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const evaluateResultSchema = z.object({
  total_score_percentage: z.number().min(0).max(100).nullable().optional(),
  questions: z.array(evaluateQuestionSchema),
});

export type EvaluateQuestion = z.infer<typeof evaluateQuestionSchema>;
export type EvaluateResult = z.infer<typeof evaluateResultSchema>;

/** Gemini responseSchema for structured evaluate output. */
export const evaluateGeminiSchema = {
  type: "OBJECT",
  properties: {
    total_score_percentage: { type: "NUMBER", nullable: true },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question_number: { type: "STRING" },
          section: { type: "STRING", nullable: true },
          title: { type: "STRING", nullable: true },
          status: { type: "STRING", enum: ["CORRECT", "ATTENTION_NEEDED"] },
          page_number: { type: "INTEGER", nullable: true },
          vertical_bounds: {
            type: "OBJECT",
            nullable: true,
            properties: {
              top_percent: { type: "NUMBER" },
              bottom_percent: { type: "NUMBER" },
            },
          },
          student_work: { type: "OBJECT", nullable: true },
          correct_reference: { type: "OBJECT", nullable: true },
          explanation: { type: "STRING", nullable: true },
          suggested_feedback: { type: "STRING", nullable: true },
          awarded: { type: "NUMBER", nullable: true },
          max: { type: "NUMBER", nullable: true },
          confidence: { type: "NUMBER", nullable: true },
        },
        required: ["question_number", "status"],
      },
    },
  },
  required: ["questions"],
} as const;

/** OpenAPI-style JSON Schema for xAI structured outputs. */
export const evaluateJsonSchema = {
  type: "object",
  properties: {
    total_score_percentage: { type: ["number", "null"] },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_number: { type: "string" },
          section: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          status: { type: "string", enum: ["CORRECT", "ATTENTION_NEEDED"] },
          page_number: { type: ["integer", "null"] },
          vertical_bounds: {
            type: ["object", "null"],
            properties: {
              top_percent: { type: "number" },
              bottom_percent: { type: "number" },
            },
            required: ["top_percent", "bottom_percent"],
            additionalProperties: false,
          },
          student_work: { type: ["object", "null"] },
          correct_reference: { type: ["object", "null"] },
          explanation: { type: ["string", "null"] },
          suggested_feedback: { type: ["string", "null"] },
          awarded: { type: ["number", "null"] },
          max: { type: ["number", "null"] },
          confidence: { type: ["number", "null"] },
        },
        required: ["question_number", "status"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

/**
 * Stable system prompt (instructions + marking scheme).
 * Keep byte-identical across scripts in a batch for xAI prompt-cache hits.
 * Put varying content (images / question focus) in the user message only.
 */
export function buildEvaluateSystemPrompt(input: {
  markingScheme: string | null;
}): string {
  const schemeBlock = input.markingScheme
    ? `\n\nMARKING SCHEME / ANSWER KEY:\n${input.markingScheme}`
    : "\n\nNo formal marking scheme — estimate marks from standard expectations.";

  return `You are an expert teacher grading handwritten student work.

Read the student's handwriting from the provided page image(s). Compare against the answer key. For each question found, return structured JSON.${schemeBlock}

Papers often have SECTIONS (A/B/C, Part I/II) that each restart question numbering (A.1 and B.1 are different questions).

For each question include:
- question_number: the printed number/letter only (e.g. "1", "2a") — do NOT put the section letter inside question_number
- section: section/part label when visible on the sheet OR clearly defined in the marking scheme (e.g. "A", "B"). Use null only when the whole paper is one continuous sequence with no sections
- title (if inferable)
- status: CORRECT or ATTENTION_NEEDED
- page_number (1-based) and vertical_bounds (top_percent/bottom_percent 0–1) locating the answer on that page
- student_work and correct_reference as JSON objects (formula, answer, steps as appropriate)
- explanation of marking decision
- suggested_feedback for the student (warm, specific)
- awarded and max marks
- confidence 0–1

Never collapse two same-numbered items from different sections into one row. Match marks to the marking scheme section when present.

Also return total_score_percentage when possible.`;
}

export function buildEvaluateUserPrompt(input?: {
  questionFocus?: string;
}): string {
  if (input?.questionFocus) {
    return `Grade the attached page image(s). Evaluate ONLY question ${input.questionFocus}. Ignore all other questions. Return JSON only.`;
  }
  return "Grade the attached page image(s). Return JSON only.";
}

/** Combined prompt for Gemini (single user text part). */
export function buildEvaluatePrompt(input: {
  markingScheme: string | null;
  questionFocus?: string;
}): string {
  const focusBlock = input.questionFocus
    ? `\n\nEvaluate ONLY question ${input.questionFocus}. Ignore all other questions.`
    : "";
  return `${buildEvaluateSystemPrompt({ markingScheme: input.markingScheme })}${focusBlock}`;
}

export function parseEvaluateResult(raw: unknown): EvaluateResult {
  const parsed = evaluateResultSchema.parse(raw);
  // Section-aware unique identity (A.1 vs B.1; restart without headers → BLK*).
  return {
    ...parsed,
    questions: canonicalizeEvaluateQuestions(parsed.questions),
  };
}
