import { GoogleGenAI } from "@google/genai";
import { requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";
import {
  buildEvaluatePrompt,
  buildEvaluateSystemPrompt,
  buildEvaluateUserPrompt,
  evaluateGeminiSchema,
  evaluateJsonSchema,
  parseEvaluateResult,
  type EvaluateResult,
} from "@/lib/evaluation/evaluate-schema";
import {
  evalPromptCacheKey,
  getEvalVisionProvider,
} from "@/lib/evaluation/eval-provider";
import {
  buildIndexPrompt,
  buildIndexUserPrompt,
  indexGeminiSchema,
  indexJsonSchema,
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
import { xaiSyncStructuredJson } from "@/lib/evaluation/xai-batch-client";

function createGenAiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireGoogleGenerativeAiApiKey() });
}

export type ImagePart = { mimeType: string; base64: string };

function imageParts(parts: ImagePart[]) {
  return parts.map((p) => ({
    inlineData: { mimeType: p.mimeType, data: p.base64 },
  }));
}

async function generateGeminiStructuredJson<T>(input: {
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

async function generateXaiStructuredJson<T>(input: {
  modelId: string;
  system: string;
  userText: string;
  images: ImagePart[];
  schemaName: string;
  schema: Record<string, unknown>;
  promptCacheKey: string;
  parse: (raw: unknown) => T;
}): Promise<{ result: T; modelId: string }> {
  const { text, modelId } = await withRetries(
    () =>
      xaiSyncStructuredJson({
        system: input.system,
        userText: input.userText,
        images: input.images.map((img) => ({
          base64: img.base64,
          mimeType: img.mimeType,
        })),
        schemaName: input.schemaName,
        schema: input.schema,
        modelId: input.modelId,
        promptCacheKey: input.promptCacheKey,
      }),
    { label: "sync-xai-responses" }
  );
  return { result: input.parse(JSON.parse(text) as unknown), modelId };
}

export async function syncIndexPage(input: {
  images: ImagePart[];
  modelId?: string;
  /** Stable id for xAI prompt cache (defaults to sync-index). */
  cacheBatchId?: string;
}): Promise<{ result: IndexResult; modelId: string }> {
  const modelId = input.modelId ?? getDefaultModelId();
  const promptCacheKey = evalPromptCacheKey({
    batchId: input.cacheBatchId ?? "sync",
    phase: "index",
  });

  async function run(activeModelId: string) {
    if (getEvalVisionProvider() === "xai") {
      return generateXaiStructuredJson({
        modelId: activeModelId,
        system: buildIndexPrompt(),
        userText: buildIndexUserPrompt(),
        images: input.images,
        schemaName: "index_result",
        schema: indexJsonSchema as unknown as Record<string, unknown>,
        promptCacheKey,
        parse: parseIndexResult,
      });
    }
    return generateGeminiStructuredJson({
      modelId: activeModelId,
      prompt: buildIndexPrompt(),
      images: input.images,
      responseSchema: indexGeminiSchema as unknown as Record<string, unknown>,
      parse: parseIndexResult,
    });
  }

  const { result, modelId: usedModel } = await run(modelId);

  if (shouldEscalateAdmission(result.admission_confidence)) {
    const escalationModel = getEscalationModelId();
    if (escalationModel && escalationModel !== usedModel) {
      return run(escalationModel);
    }
  }

  return { result, modelId: usedModel };
}

export async function syncEvaluateScript(input: {
  images: ImagePart[];
  markingScheme: string | null;
  questionFocus?: string;
  modelId?: string;
  cacheBatchId?: string;
}): Promise<{ result: EvaluateResult; modelId: string }> {
  const modelId = input.modelId ?? getDefaultModelId();
  const promptCacheKey = evalPromptCacheKey({
    batchId: input.cacheBatchId ?? "sync",
    phase: "evaluate",
  });

  async function runEvaluate(activeModelId: string) {
    if (getEvalVisionProvider() === "xai") {
      return generateXaiStructuredJson({
        modelId: activeModelId,
        system: buildEvaluateSystemPrompt({
          markingScheme: input.markingScheme,
        }),
        userText: buildEvaluateUserPrompt({
          questionFocus: input.questionFocus,
        }),
        images: input.images,
        schemaName: "evaluate_result",
        schema: evaluateJsonSchema as unknown as Record<string, unknown>,
        promptCacheKey,
        parse: parseEvaluateResult,
      });
    }
    return generateGeminiStructuredJson({
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
        const focusedModelId =
          escalationModel && escalationModel !== outcome.modelId
            ? escalationModel
            : outcome.modelId;

        let focused: { result: EvaluateResult; modelId: string };
        if (getEvalVisionProvider() === "xai") {
          focused = await generateXaiStructuredJson({
            modelId: focusedModelId,
            system: buildEvaluateSystemPrompt({
              markingScheme: input.markingScheme,
            }),
            userText: buildEvaluateUserPrompt({
              questionFocus: question.question_number,
            }),
            images: input.images,
            schemaName: "evaluate_result",
            schema: evaluateJsonSchema as unknown as Record<string, unknown>,
            promptCacheKey,
            parse: parseEvaluateResult,
          });
        } else {
          focused = await generateGeminiStructuredJson({
            modelId: focusedModelId,
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
        }

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
