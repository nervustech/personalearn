import { generateText } from "ai";
import { getEvalVisionModel, requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";
import { normalizeAdmissionNumber } from "@/lib/evaluation/normalize-admission";

const PAGE_READ_PROMPT = `You are reading a scanned student exam/assignment page (Kenyan classroom handwriting).

Extract:
1. admission_number — the student admission/registration number written on the page (null if missing or unreadable)
2. question_numbers — array of question numbers visible on this page (integers). If a range like "Q3–Q5" appears, include 3,4,5. Empty array if none found.

Return ONLY valid JSON with keys admission_number and question_numbers. No markdown.`;

export type ScriptPageRead = {
  admissionNumber: string | null;
  questionNumbers: number[];
};

function parseQuestionNumbers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const nums = raw
    .map((n) => (typeof n === "number" ? n : Number.parseInt(String(n), 10)))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function parseScriptPageReadJson(text: string): ScriptPageRead {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { admissionNumber: null, questionNumbers: [] };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      admission_number?: unknown;
      question_numbers?: unknown;
    };
    const admission =
      typeof parsed.admission_number === "string"
        ? normalizeAdmissionNumber(parsed.admission_number)
        : parsed.admission_number == null
          ? null
          : normalizeAdmissionNumber(String(parsed.admission_number));
    return {
      admissionNumber: admission,
      questionNumbers: parseQuestionNumbers(parsed.question_numbers),
    };
  } catch {
    return { admissionNumber: null, questionNumbers: [] };
  }
}

export async function readScriptPageFromImage(input: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<ScriptPageRead> {
  requireGoogleGenerativeAiApiKey();

  const { text } = await generateText({
    model: getEvalVisionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: input.bytes,
            mediaType: input.mimeType || "image/jpeg",
          },
          { type: "text", text: PAGE_READ_PROMPT },
        ],
      },
    ],
  });

  return parseScriptPageReadJson(text);
}
