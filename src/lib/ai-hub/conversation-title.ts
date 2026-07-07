const MAX_TITLE_LENGTH = 60;

export function generateConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "New conversation";
  }

  if (cleaned.length <= MAX_TITLE_LENGTH) {
    return cleaned;
  }

  return `${cleaned.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}
