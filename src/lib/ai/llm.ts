import { createDeepSeek } from "@ai-sdk/deepseek";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import {
  getChatProvider,
  requireChatApiKey,
  type ChatProvider,
} from "@/lib/ai/env";

const DEEPSEEK_MODEL = "deepseek-chat";
const XAI_MODEL = "grok-3-mini";

export function getChatModelForProvider(provider: ChatProvider): LanguageModel {
  const apiKey = requireChatApiKey(provider);

  if (provider === "xai") {
    return createXai({ apiKey })(XAI_MODEL);
  }

  return createDeepSeek({ apiKey })(DEEPSEEK_MODEL);
}

export function getChatModel(): LanguageModel {
  return getChatModelForProvider(getChatProvider());
}
