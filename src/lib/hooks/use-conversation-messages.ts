"use client";

import { useQuery } from "@tanstack/react-query";
import {
  conversationMessagesQueryKey,
  fetchConversationMessages,
} from "@/lib/ai-hub/fetch-conversation-messages";

export const CONVERSATION_MESSAGES_STALE_TIME = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationMessagesQueryKey(conversationId ?? ""),
    enabled: Boolean(conversationId),
    queryFn: () => fetchConversationMessages(conversationId!),
    staleTime: CONVERSATION_MESSAGES_STALE_TIME,
    gcTime: THIRTY_MINUTES,
  });
}

export { conversationMessagesQueryKey, fetchConversationMessages };
