import { isTextUIPart, type UIMessage } from "ai";
import { stripResourceTypeTitlePrefix } from "@/lib/resources/format";

export type ConversationMessageRole = "user" | "assistant" | "tool";

const DRAFT_TOOL_TYPES = new Set([
  "tool-generate_learning_resource",
  "tool-update_draft",
]);

export type VisibleDraft = {
  title: string;
  resourceType?: string;
  content: string;
};

export function getMessageText(message: Pick<UIMessage, "parts">): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

export function getVisibleDrafts(
  message: Pick<UIMessage, "parts">
): VisibleDraft[] {
  return message.parts
    .map((part) => draftFromPart(part))
    .filter((draft): draft is VisibleDraft => draft !== null);
}

export type AssistantDisplayBlock =
  | { type: "text"; text: string }
  | { type: "draft"; draft: VisibleDraft };

export function getAssistantDisplayBlocks(
  message: Pick<UIMessage, "parts">
): AssistantDisplayBlock[] {
  const blocks: AssistantDisplayBlock[] = [];

  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      const text = stripDatabaseIdsFromTeacherText(part.text);
      if (text) {
        blocks.push({ type: "text", text });
      }
      continue;
    }

    const draft = draftFromPart(part);
    if (draft) {
      blocks.push({ type: "draft", draft });
    }
  }

  return blocks;
}

function draftFromPart(part: UIMessage["parts"][number]): VisibleDraft | null {
  if (!DRAFT_TOOL_TYPES.has(part.type)) return null;

  const record = part as { state?: string; output?: unknown };
  if (record.state !== "output-available") return null;
  if (!record.output || typeof record.output !== "object") return null;

  const output = record.output as Record<string, unknown>;
  const content =
    typeof output.content === "string" ? output.content.trim() : "";
  if (!content) return null;

  return {
    title: stripResourceTypeTitlePrefix(
      typeof output.title === "string" && output.title.trim()
        ? output.title.trim()
        : "Draft",
      typeof output.resourceType === "string" ? output.resourceType : ""
    ),
    resourceType:
      typeof output.resourceType === "string" ? output.resourceType : undefined,
    content,
  };
}

export function getAssistantPersistContent(
  message: Pick<UIMessage, "parts">
): string {
  const blocks = getAssistantDisplayBlocks(message);
  if (blocks.length === 0) return "";

  return blocks
    .map((block) =>
      block.type === "text"
        ? block.text
        : `## ${block.draft.title}\n\n${block.draft.content}`
    )
    .join("\n\n");
}

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export function stripDatabaseIdsFromTeacherText(text: string): string {
  return text
    .replace(
      /\b(?:resourceId|studentId|draftId|assessmentId|id)\s*[:=]\s*[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ""
    )
    .replace(UUID_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function truncateMessagesBefore(
  messages: UIMessage[],
  messageId: string
): UIMessage[] {
  const index = messages.findIndex((message) => message.id === messageId);
  if (index === -1) {
    return messages;
  }

  return messages.slice(0, index);
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
