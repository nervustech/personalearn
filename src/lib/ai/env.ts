export const VOYAGE_EMBEDDING_DIM = 1024;

export const DEFAULT_VOYAGE_MODEL = "voyage-3.5";
export const DEFAULT_CHAT_PROVIDER = "deepseek";

export type ChatProvider = "deepseek" | "xai";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getVoyageEmbeddingModel() {
  return clean(process.env.VOYAGE_EMBEDDING_MODEL) ?? DEFAULT_VOYAGE_MODEL;
}

export function getChatProvider(): ChatProvider {
  const raw = clean(process.env.CHAT_PROVIDER)?.toLowerCase();
  if (raw === "xai" || raw === "grok") {
    return "xai";
  }
  return DEFAULT_CHAT_PROVIDER;
}

export function requireVoyageApiKey() {
  const key = clean(process.env.VOYAGE_API_KEY);
  if (!key) {
    throw new Error(
      "Missing VOYAGE_API_KEY. Set it in .env.local (server-only)."
    );
  }
  return key;
}

export function requireChatApiKey(provider: ChatProvider) {
  if (provider === "xai") {
    const key = clean(process.env.XAI_API_KEY);
    if (!key) {
      throw new Error(
        "Missing XAI_API_KEY for Grok chat. Set CHAT_PROVIDER=deepseek (and DEEPSEEK_API_KEY) or add XAI_API_KEY in this environment (e.g. Vercel Production)."
      );
    }
    return key;
  }

  const key = clean(process.env.DEEPSEEK_API_KEY);
  if (!key) {
    throw new Error(
      "Missing DEEPSEEK_API_KEY for AI Hub chat. Set DEEPSEEK_API_KEY (and optionally CHAT_PROVIDER=deepseek) in this environment (e.g. Vercel Production)."
    );
  }
  return key;
}

/** Fail before streaming so the client gets a JSON error instead of an empty SSE body. */
export function assertChatConfigured() {
  requireChatApiKey(getChatProvider());
}
