import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";
/** Preferred bulk/eval path — replaces retired-for-new-users `gemini-2.5-flash-lite`. */
export const GEMINI_FLASH_LITE_MODEL = "gemini-3.1-flash-lite";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function requireGoogleGenerativeAiApiKey() {
  const key = clean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  if (!key) {
    throw new Error(
      "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add it to .env.local for image uploads."
    );
  }
  return key;
}

function googleModel(modelId: string): LanguageModel {
  const apiKey = requireGoogleGenerativeAiApiKey();
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelId);
}

/** Sprint 4 resource image OCR — Flash. */
export function getGeminiFlashModel(): LanguageModel {
  return googleModel(GEMINI_FLASH_MODEL);
}

/**
 * Sprint 5 eval identity reads — Lite by default.
 * Override with EVAL_VISION_MODEL (escape hatch; no auto-escalation ladder).
 */
export function getEvalVisionModel(): LanguageModel {
  const override = clean(process.env.EVAL_VISION_MODEL);
  return googleModel(override ?? GEMINI_FLASH_LITE_MODEL);
}
