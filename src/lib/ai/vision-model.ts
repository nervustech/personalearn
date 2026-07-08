import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";

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

export function getGeminiFlashModel(): LanguageModel {
  const apiKey = requireGoogleGenerativeAiApiKey();
  const google = createGoogleGenerativeAI({ apiKey });
  return google(GEMINI_FLASH_MODEL);
}
