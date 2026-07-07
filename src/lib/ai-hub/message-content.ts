import { isTextUIPart, type UIMessage } from "ai";

export type ConversationMessageRole = "user" | "assistant" | "tool";

export function getMessageText(message: Pick<UIMessage, "parts">): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

export function toUIMessageFromRow(row: {
  id: string;
  role: ConversationMessageRole;
  content: string;
}): UIMessage {
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    parts: [{ type: "text", text: row.content }],
  };
}
