import { requireChatApiKey } from "@/lib/ai/env";
import {
  GEMINI_FLASH_LITE_MODEL,
  requireGoogleGenerativeAiApiKey,
} from "@/lib/ai/vision-model";

export type EvalVisionProvider = "xai" | "gemini";

/** Default pilot model for xAI Batch + vision eval. */
export const GROK_EVAL_MODEL = "grok-4.3";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Vision provider for evaluation (index + grade).
 * Default: xai (Grok 4.3 Batch pilot). Set EVAL_VISION_PROVIDER=gemini to use Gemini.
 */
export function getEvalVisionProvider(): EvalVisionProvider {
  const raw = clean(process.env.EVAL_VISION_PROVIDER)?.toLowerCase();
  if (raw === "gemini" || raw === "google") return "gemini";
  if (raw === "xai" || raw === "grok") return "xai";
  // Unset → prefer xAI when key is present (local pilot), else Gemini.
  if (clean(process.env.XAI_API_KEY)) return "xai";
  return "gemini";
}

export function getEvalVisionModelId(): string {
  const override = clean(process.env.EVAL_VISION_MODEL);
  if (override) return override;
  return getEvalVisionProvider() === "xai"
    ? GROK_EVAL_MODEL
    : GEMINI_FLASH_LITE_MODEL;
}

export function requireEvalVisionApiKey(): string {
  if (getEvalVisionProvider() === "xai") {
    return requireChatApiKey("xai");
  }
  return requireGoogleGenerativeAiApiKey();
}

/** Sticky cache key for xAI prompt caching (same server → higher hit rate). */
export function evalPromptCacheKey(input: {
  batchId: string;
  phase: "index" | "evaluate";
}): string {
  return `pl-eval:${input.batchId}:${input.phase}`;
}
