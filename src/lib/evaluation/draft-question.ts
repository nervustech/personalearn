import { generateText } from "ai";
import { getEvalVisionModel, requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";
import { parseQuestionLabels } from "@/lib/evaluation/normalize-question";
import type { QuestionEvaluationStatus } from "@/types/database";

export type DraftPageImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export type DraftQuestionResult = {
  awarded: number | null;
  max: number | null;
  feedback: string | null;
  student_answer: string | null;
  expected_answer: string | null;
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

function parseOptionalText(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (raw == null) return null;
  const asString = String(raw).trim();
  return asString.length > 0 ? asString : null;
}

const EMPTY_DRAFT: DraftQuestionResult = {
  awarded: null,
  max: null,
  feedback: null,
  student_answer: null,
  expected_answer: null,
};

export function parseDraftQuestionJson(text: string): DraftQuestionResult {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...EMPTY_DRAFT };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      awarded?: unknown;
      max?: unknown;
      feedback?: unknown;
      student_answer?: unknown;
      expected_answer?: unknown;
    };
    return {
      awarded: parseFiniteNumber(parsed.awarded),
      max: parseFiniteNumber(parsed.max),
      feedback: parseOptionalText(parsed.feedback),
      student_answer: parseOptionalText(parsed.student_answer),
      expected_answer: parseOptionalText(parsed.expected_answer),
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

function buildGradePrompt(
  questionLabel: string,
  schemeText: string | null,
  instruction?: string | null
): string {
  const instructionBlock =
    instruction && instruction.trim().length > 0
      ? `\n\nTeacher instruction for this re-evaluation (follow carefully):\n---\n${instruction.trim()}\n---\n`
      : "";

  if (schemeText) {
    return `You are grading one question from a scanned Kenyan classroom exam/assignment script.

Grade ONLY question "${questionLabel}" (this may be a part such as 1a, a letter such as b, or a section label) using the marking scheme below.
${instructionBlock}
Marking scheme:
---
${schemeText}
---

Return ONLY valid JSON with keys:
- awarded (number — marks awarded)
- max (number — maximum marks for this question from the scheme)
- feedback (string — brief rationale for the teacher/student)
- student_answer (string — short excerpt of what the student wrote for this question)
- expected_answer (string — what the marking scheme required for this question)

No markdown.`;
  }

  return `You are estimating marks for one question from a scanned Kenyan classroom exam/assignment script.

There is NO marking scheme. Use best judgment for question "${questionLabel}". Marks are lower confidence (AI estimate).
${instructionBlock}
Return ONLY valid JSON with keys:
- awarded (number — estimated marks awarded)
- max (number — estimated maximum for this question)
- feedback (string — brief rationale noting this is an estimate without a scheme)
- student_answer (string — short excerpt of what the student wrote for this question)
- expected_answer (null — always null when there is no marking scheme)

No markdown.`;
}

export async function draftQuestionFromImages(input: {
  pages: DraftPageImage[];
  questionLabel: string;
  schemeText: string | null;
  instruction?: string | null;
}): Promise<DraftQuestionResult> {
  requireGoogleGenerativeAiApiKey();
  if (input.pages.length === 0) {
    return {
      ...EMPTY_DRAFT,
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
            text: buildGradePrompt(
              input.questionLabel,
              input.schemeText,
              input.instruction
            ),
          },
        ],
      },
    ],
  });

  const parsed = parseDraftQuestionJson(text);
  const hasScheme = Boolean(input.schemeText && input.schemeText.trim().length > 0);
  return {
    ...parsed,
    // No scheme → never store an "expected" answer even if the model invents one.
    expected_answer: hasScheme ? parsed.expected_answer : null,
  };
}

/** When identity left no question labels, ask vision to list them from all pages. */
export async function listQuestionsFromImages(
  pages: DraftPageImage[]
): Promise<string[]> {
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
            text: `List every question label visible across these scanned script pages.
Include parts and letters when present (e.g. "1", "1a", "1.b", "a", "b", "sectiona").
Return ONLY valid JSON: { "question_numbers": ["1a", "1b", ...] }
Empty array if none found. No markdown.`,
          },
        ],
      },
    ],
  });

  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { question_numbers?: unknown };
    return parseQuestionLabels(parsed.question_numbers);
  } catch {
    return [];
  }
}
