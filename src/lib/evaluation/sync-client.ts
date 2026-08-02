import { GoogleGenAI } from "@google/genai";
import { requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";
import {
  buildEvaluatePrompt,
  evaluateGeminiSchema,
  parseEvaluateResult,
  type EvaluateResult,
} from "@/lib/evaluation/evaluate-schema";
import {
  buildIndexPrompt,
  indexGeminiSchema,
  parseIndexResult,
  type IndexResult,
} from "@/lib/evaluation/index-schema";
import {
  getDefaultModelId,
  getEscalationModelId,
  shouldEscalateAdmission,
  shouldEscalateQuestion,
} from "@/lib/evaluation/escalate";
import { withRetries } from "@/lib/evaluation/retries";

function createGenAiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireGoogleGenerativeAiApiKey() });
}

type ImagePart = { mimeType: string; base64: string };

function imageParts(parts: ImagePart[]) {
  return parts.map((p) => ({
    inlineData: { mimeType: p.mimeType, data: p.base64 },
  }));
}

async function generateStructuredJson<T>(input: {
  modelId: string;
  prompt: string;
  images: ImagePart[];
  responseSchema: Record<string, unknown>;
  parse: (raw: unknown) => T;
}): Promise<{ result: T; modelId: string }> {
  const ai = createGenAiClient();

  const response = await withRetries(
    () =>
      ai.models.generateContent({
        model: input.modelId,
        contents: [
          {
            role: "user",
            parts: [{ text: input.prompt }, ...imageParts(input.images)],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: input.responseSchema,
        },
      }),
    { label: "sync-generateContent" }
  );

  const text = response.text;
  if (!text) throw new Error("Empty model response");
  const parsed = JSON.parse(text) as unknown;
  return { result: input.parse(parsed), modelId: input.modelId };
}

export async function syncIndexPage(input: {
  images: ImagePart[];
  modelId?: string;
}): Promise<{ result: IndexResult; modelId: string }> {
  const modelId = input.modelId ?? getDefaultModelId();
  const { result, modelId: usedModel } = await generateStructuredJson({
    modelId,
    prompt: buildIndexPrompt(),
    images: input.images,
    responseSchema: indexGeminiSchema as unknown as Record<string, unknown>,
    parse: parseIndexResult,
  });

  if (shouldEscalateAdmission(result.admission_confidence)) {
    const escalationModel = getEscalationModelId();
    if (escalationModel && escalationModel !== usedModel) {
      return generateStructuredJson({
        modelId: escalationModel,
        prompt: buildIndexPrompt(),
        images: input.images,
        responseSchema: indexGeminiSchema as unknown as Record<string, unknown>,
        parse: parseIndexResult,
      });
    }
  }

  return { result, modelId: usedModel };
}

export async function syncEvaluateScript(input: {
  images: ImagePart[];
  markingScheme: string | null;
  questionFocus?: string;
  modelId?: string;
}): Promise<{ result: EvaluateResult; modelId: string }> {
  const modelId = input.modelId ?? getDefaultModelId();

  async function runEvaluate(activeModelId: string) {
    return generateStructuredJson({
      modelId: activeModelId,
      prompt: buildEvaluatePrompt({
        markingScheme: input.markingScheme,
        questionFocus: input.questionFocus,
      }),
      images: input.images,
      responseSchema: evaluateGeminiSchema as unknown as Record<string, unknown>,
      parse: parseEvaluateResult,
    });
  }

  let outcome: { result: EvaluateResult; modelId: string };
  try {
    outcome = await runEvaluate(modelId);
  } catch (firstError) {
    const escalationModel = getEscalationModelId();
    if (escalationModel && escalationModel !== modelId) {
      outcome = await runEvaluate(escalationModel);
    } else {
      throw firstError;
    }
  }

  const lowConfidence = outcome.result.questions.some((q) =>
    shouldEscalateQuestion(q.confidence)
  );
  const escalationModel = getEscalationModelId();
  if (
    lowConfidence &&
    escalationModel &&
    escalationModel !== outcome.modelId &&
    !input.questionFocus
  ) {
    outcome = await runEvaluate(escalationModel);
  }

  if (!input.questionFocus) {
    const needsMicroEval = outcome.result.questions.filter(
      (q) =>
        q.status === "ATTENTION_NEEDED" && shouldEscalateQuestion(q.confidence)
    );
    for (const question of needsMicroEval) {
      try {
        const focused = await generateStructuredJson({
          modelId:
            escalationModel && escalationModel !== outcome.modelId
              ? escalationModel
              : outcome.modelId,
          prompt: buildEvaluatePrompt({
            markingScheme: input.markingScheme,
            questionFocus: question.question_number,
          }),
          images: input.images,
          responseSchema: evaluateGeminiSchema as unknown as Record<
            string,
            unknown
          >,
          parse: parseEvaluateResult,
        });
        const replacement = focused.result.questions.find(
          (q) => q.question_number === question.question_number
        );
        if (replacement) {
          outcome.result.questions = outcome.result.questions.map((q) =>
            q.question_number === question.question_number ? replacement : q
          );
        }
      } catch {
        // Keep the original question row on targeted re-prompt failure.
      }
    }
  }

  return outcome;
}

export type { ImagePart };
