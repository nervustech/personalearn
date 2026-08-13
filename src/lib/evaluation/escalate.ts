import {
  GEMINI_FLASH_MODEL,
  GEMINI_PRO_VISION_MODEL,
  isEvalVisionEscalationEnabled,
} from "@/lib/ai/vision-model";
import {
  getEvalVisionModelId,
  getEvalVisionProvider,
} from "@/lib/evaluation/eval-provider";

export const ADMISSION_CONFIDENCE_THRESHOLD = 0.75;
export const QUESTION_CONFIDENCE_THRESHOLD = 0.65;

export function shouldEscalateAdmission(confidence: number | null | undefined): boolean {
  if (confidence == null) return true;
  return confidence < ADMISSION_CONFIDENCE_THRESHOLD;
}

export function shouldEscalateQuestion(confidence: number | null | undefined): boolean {
  if (confidence == null) return false;
  return confidence < QUESTION_CONFIDENCE_THRESHOLD;
}

export function getEscalationModelId(): string | null {
  if (!isEvalVisionEscalationEnabled()) return null;
  const override = process.env.EVAL_VISION_ESCALATION_MODEL?.trim();
  if (override) return override;
  // Grok pilot: no default escalation tier unless explicitly configured.
  if (getEvalVisionProvider() === "xai") return null;
  return GEMINI_FLASH_MODEL;
}

export function getDefaultModelId(): string {
  return getEvalVisionModelId();
}

export function getProModelId(): string {
  return process.env.EVAL_VISION_ESCALATION_MODEL?.trim() || GEMINI_PRO_VISION_MODEL;
}
