import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ImageModel, LanguageModel } from "ai";

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";
/** Preferred bulk/eval path — replaces retired-for-new-users `gemini-2.5-flash-lite`. */
export const GEMINI_FLASH_LITE_MODEL = "gemini-3.1-flash-lite";
/** Higher tier for evidence-gated escalation (F7) — not used unless explicitly enabled. */
export const GEMINI_PRO_VISION_MODEL = "gemini-2.5-pro";
/**
 * Default teaching-aid image model (AI Hub / PSL-83).
 * Imagen (`imagen-4.0-generate-001`) is no longer available to new Gemini API keys —
 * use Gemini image models via `google.image(...)` instead.
 */
export const DEFAULT_IMAGE_GENERATION_MODEL = "gemini-2.5-flash-image";

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

function googleProvider() {
  return createGoogleGenerativeAI({
    apiKey: requireGoogleGenerativeAiApiKey(),
  });
}

function googleModel(modelId: string): LanguageModel {
  return googleProvider()(modelId);
}

/** Sprint 4 resource image OCR — Flash. */
export function getGeminiFlashModel(): LanguageModel {
  return googleModel(GEMINI_FLASH_MODEL);
}

/**
 * Sprint 5 / Epic F eval vision — Lite by default (ADR-003 / ADR-004).
 *
 * Override base model with EVAL_VISION_MODEL (e.g. gemini-2.5-flash).
 *
 * Escalation hook (F7): set EVAL_VISION_ESCALATION=1 to allow a higher-tier
 * fallback via getEvalVisionEscalationModel(). Escalation stays OFF by default
 * until real handwriting samples justify Flash/Pro spend.
 */
export function getEvalVisionModel(): LanguageModel {
  const override = clean(process.env.EVAL_VISION_MODEL);
  return googleModel(override ?? GEMINI_FLASH_LITE_MODEL);
}

export function getEvalVisionModelId(): string {
  return clean(process.env.EVAL_VISION_MODEL) ?? GEMINI_FLASH_LITE_MODEL;
}

/** True only when EVAL_VISION_ESCALATION is explicitly enabled. */
export function isEvalVisionEscalationEnabled(): boolean {
  const raw = clean(process.env.EVAL_VISION_ESCALATION)?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Higher-tier vision model for hard pages. Returns null when escalation is off
 * (default) so callers must no-op rather than silently upgrade cost.
 */
export function getEvalVisionEscalationModel(): LanguageModel | null {
  if (!isEvalVisionEscalationEnabled()) return null;
  const override = clean(process.env.EVAL_VISION_ESCALATION_MODEL);
  return googleModel(override ?? GEMINI_FLASH_MODEL);
}

/** Teaching-aid image generation (AI Hub) — override with IMAGE_GENERATION_MODEL. */
export function getImageGenerationModel(): ImageModel {
  const override = clean(process.env.IMAGE_GENERATION_MODEL);
  return googleProvider().image(override ?? DEFAULT_IMAGE_GENERATION_MODEL);
}
