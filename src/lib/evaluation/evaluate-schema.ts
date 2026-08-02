import { z } from "zod";

export const verticalBoundsSchema = z.object({
  top_percent: z.number().min(0).max(1),
  bottom_percent: z.number().min(0).max(1),
});

export const evaluateQuestionSchema = z.object({
  question_number: z.string(),
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

export function buildEvaluatePrompt(input: {
  markingScheme: string | null;
  questionFocus?: string;
}): string {
  const schemeBlock = input.markingScheme
    ? `\n\nMARKING SCHEME / ANSWER KEY:\n${input.markingScheme}`
    : "\n\nNo formal marking scheme — estimate marks from standard expectations.";

  const focusBlock = input.questionFocus
    ? `\n\nEvaluate ONLY question ${input.questionFocus}. Ignore all other questions.`
    : "";

  return `You are an expert teacher grading handwritten student work.

Read the student's handwriting from the provided page image(s). Compare against the answer key. For each question found, return structured JSON.${schemeBlock}${focusBlock}

For each question include:
- question_number, title (if inferable)
- status: CORRECT or ATTENTION_NEEDED
- page_number (1-based) and vertical_bounds (top_percent/bottom_percent 0–1) locating the answer on that page
- student_work and correct_reference as JSON objects (formula, answer, steps as appropriate)
- explanation of marking decision
- suggested_feedback for the student (warm, specific)
- awarded and max marks
- confidence 0–1

Also return total_score_percentage when possible.`;
}

export function parseEvaluateResult(raw: unknown): EvaluateResult {
  return evaluateResultSchema.parse(raw);
}
