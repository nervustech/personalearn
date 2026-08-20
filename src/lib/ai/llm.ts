import { createDeepSeek } from "@ai-sdk/deepseek";
import { createXai } from "@ai-sdk/xai";
import { type LanguageModel } from "ai";
import {
  getChatProvider,
  requireChatApiKey,
  type ChatProvider,
} from "@/lib/ai/env";

const DEEPSEEK_MODEL = "deepseek-chat";
const XAI_MODEL = "grok-3-mini";
const XAI_VISION_MODEL = "grok-4.3";

export function getChatModelForProvider(provider: ChatProvider): LanguageModel {
  const apiKey = requireChatApiKey(provider);

  return provider === "xai"
    ? createXai({ apiKey })(XAI_MODEL)
    : createDeepSeek({ apiKey })(DEEPSEEK_MODEL);
}

export function getChatModel(): LanguageModel {
  return getChatModelForProvider(getChatProvider());
}

/** Vision-capable model for image text extraction in chat. Uses xAI. */
export function getVisionExtractionModel(): LanguageModel {
  const apiKey = requireChatApiKey("xai");
  return createXai({ apiKey })(XAI_VISION_MODEL);
}
