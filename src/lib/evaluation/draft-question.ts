import { generateText } from "ai";
import { getEvalVisionModel, requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";
import type { QuestionEvaluationStatus } from "@/types/database";

export type DraftPageImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export type DraftQuestionResult = {
  awarded: number | null;
  max: number | null;
  feedback: string | null;
};

export function questionEvaluationStatusForScheme(
  schemeText: string | null | undefined
): QuestionEvaluationStatus {
  return schemeText && schemeText.trim().length > 0 ? "ai_draft" : "ai_estimate";
}

function parseFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseDraftQuestionJson(text: string): DraftQuestionResult {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { awarded: null, max: null, feedback: null };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      awarded?: unknown;
      max?: unknown;
      feedback?: unknown;
    };
    return {
      awarded: parseFiniteNumber(parsed.awarded),
      max: parseFiniteNumber(parsed.max),
      feedback:
        typeof parsed.feedback === "string"
          ? parsed.feedback.trim() || null
          : parsed.feedback == null
            ? null
            : String(parsed.feedback).trim() || null,
    };
  } catch {
    return { awarded: null, max: null, feedback: null };
  }
}

function parseQuestionListJson(text: string): number[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { question_numbers?: unknown };
    if (!Array.isArray(parsed.question_numbers)) return [];
    const nums = parsed.question_numbers
      .map((n) =>
        typeof n === "number" ? n : Number.parseInt(String(n), 10)
      )
      .filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(nums)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function buildGradePrompt(
  questionNumber: number,
  schemeText: string | null
): string {
  if (schemeText) {
    return `You are grading one question from a scanned Kenyan classroom exam/assignment script.

Grade ONLY question ${questionNumber} using the marking scheme below.

Marking scheme:
---
${schemeText}
---

Return ONLY valid JSON with keys:
- awarded (number — marks awarded)
- max (number — maximum marks for this question from the scheme)
- feedback (string — brief feedback for the teacher/student)

No markdown.`;
  }

  return `You are estimating marks for one question from a scanned Kenyan classroom exam/assignment script.

There is NO marking scheme. Use best judgment for question ${questionNumber}. Marks are lower confidence (AI estimate).

Return ONLY valid JSON with keys:
- awarded (number — estimated marks awarded)
- max (number — estimated maximum for this question)
- feedback (string — brief feedback noting this is an estimate without a scheme)

No markdown.`;
}

export async function draftQuestionFromImages(input: {
  pages: DraftPageImage[];
  questionNumber: number;
  schemeText: string | null;
}): Promise<DraftQuestionResult> {
  requireGoogleGenerativeAiApiKey();
  if (input.pages.length === 0) {
    return {
      awarded: null,
      max: null,
      feedback: "No page images available for this question.",
    };
  }

  const { text } = await generateText({
    model: getEvalVisionModel(),
    messages: [
      {
        role: "user",
        content: [
          ...input.pages.map((page) => ({
            type: "image" as const,
            image: page.bytes,
            mediaType: page.mimeType || "image/jpeg",
          })),
          {
            type: "text" as const,
            text: buildGradePrompt(input.questionNumber, input.schemeText),
          },
        ],
      },
    ],
  });

  return parseDraftQuestionJson(text);
}

/** When identity left no question numbers, ask vision to list them from all pages. */
export async function listQuestionsFromImages(
  pages: DraftPageImage[]
): Promise<number[]> {
  requireGoogleGenerativeAiApiKey();
  if (pages.length === 0) return [];

  const { text } = await generateText({
    model: getEvalVisionModel(),
    messages: [
      {
        role: "user",
        content: [
          ...pages.map((page) => ({
            type: "image" as const,
            image: page.bytes,
            mediaType: page.mimeType || "image/jpeg",
          })),
          {
            type: "text" as const,
            text: `List every question number visible across these scanned script pages.
Return ONLY valid JSON: { "question_numbers": [1, 2, ...] }
Empty array if none found. No markdown.`,
          },
        ],
      },
    ],
  });

  return parseQuestionListJson(text);
}
