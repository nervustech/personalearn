"use client";

import { useQuery } from "@tanstack/react-query";
import type { ConversationRow } from "@/lib/ai-hub/conversations";

export const conversationsQueryKey = (classId: string) =>
  ["ai-hub-conversations", classId] as const;

async function fetchConversations(classId: string): Promise<ConversationRow[]> {
  const response = await fetch(
    `/api/ai-hub/conversations?classId=${encodeURIComponent(classId)}`
  );
  const payload = (await response.json()) as {
    conversations?: ConversationRow[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load conversations");
  }

  return payload.conversations ?? [];
}

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export function useConversations(classId: string | undefined) {
  return useQuery({
    queryKey: conversationsQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: () => fetchConversations(classId!),
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
  });
}
