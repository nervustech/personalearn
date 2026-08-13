import type { UIMessage } from "ai";

export const conversationMessagesQueryKey = (conversationId: string) =>
  ["ai-hub-conversation-messages", conversationId] as const;

export async function fetchConversationMessages(
  conversationId: string
): Promise<UIMessage[]> {
  const response = await fetch(`/api/ai-hub/conversations/${conversationId}`);
  const payload = (await response.json()) as {
    messages?: UIMessage[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load conversation");
  }

  return payload.messages ?? [];
}
