"use client";

import { isFileUIPart, type UIMessage } from "ai";
import { FileText, Paperclip, Pencil } from "lucide-react";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import {
  getAssistantDisplayBlocks,
  getMessageText,
  getVisibleDrafts,
  stripDatabaseIdsFromTeacherText,
} from "@/lib/ai-hub/message-content";
import {
  formatResourceType,
  isResourceType,
} from "@/lib/resources/format";
import { cn } from "@/lib/utils";

type ChatMessageProps = {
  message: UIMessage;
  canEdit?: boolean;
  onEdit?: (messageId: string, text: string) => void;
};

export function ChatMessage({
  message,
  canEdit = false,
  onEdit,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const rawText = getMessageText(message);
  const text = isUser ? rawText : stripDatabaseIdsFromTeacherText(rawText);
  const drafts = getVisibleDrafts(message);
  const displayBlocks = isUser ? [] : getAssistantDisplayBlocks(message);
  const fileParts = message.parts.filter(isFileUIPart);

  if (!text && fileParts.length === 0 && drafts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "group/message flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex items-end gap-1.5",
          isUser
            ? "max-w-[min(85%,42rem)] flex-row-reverse"
            : "min-w-0 max-w-[min(100%,48rem)] flex-row"
        )}
      >
        <div
          className={cn(
            "text-[0.9375rem] leading-relaxed",
            isUser
              ? "rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
              : "min-w-0 flex-1 text-foreground"
          )}
        >
          {fileParts.length > 0 ? (
            <div
              className={cn(
                "mb-2 flex flex-wrap gap-1.5",
                text ? "" : "mb-0"
              )}
            >
              {fileParts.map((part, index) => (
                <span
                  key={`${part.filename ?? "file"}-${index}`}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                    isUser
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "border border-border/80 bg-muted/50 text-muted-foreground"
                  )}
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{part.filename ?? "Attachment"}</span>
                </span>
              ))}
            </div>
          ) : null}
          {isUser ? (
            text ? (
              <p className="whitespace-pre-wrap">{text}</p>
            ) : null
          ) : (
            <div className="space-y-3">
              {displayBlocks.map((block, index) => {
                if (block.type === "text") {
                  return (
                    <MarkdownContent
                      key={`text-${index}`}
                      content={block.text}
                    />
                  );
                }

                const typeLabel =
                  block.draft.resourceType &&
                  isResourceType(block.draft.resourceType)
                    ? formatResourceType(block.draft.resourceType)
                    : null;

                return (
                  <div
                    key={`draft-${block.draft.title}-${index}`}
                    className="overflow-hidden rounded-xl border border-border/80 bg-muted/30"
                  >
                    <div className="flex items-center gap-1.5 border-b border-border/80 px-3 py-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        Draft{typeLabel ? ` · ${typeLabel}` : ""} ·{" "}
                        {block.draft.title}
                      </span>
                    </div>
                    <div className="px-3 py-3">
                      <MarkdownContent content={block.draft.content} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isUser && canEdit && onEdit && text ? (
          <button
            type="button"
            aria-label="Edit message"
            onClick={() => onEdit(message.id, text)}
            className="mb-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/message:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
