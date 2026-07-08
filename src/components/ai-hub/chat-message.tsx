"use client";

import type { UIMessage } from "ai";
import { Pencil, Sparkles, User } from "lucide-react";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { getMessageText } from "@/lib/ai-hub/message-content";
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
  const text = getMessageText(message);
  const isUser = message.role === "user";

  if (!text) {
    return null;
  }

  return (
    <div
      className={cn(
        "group/message flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      <div
        className={cn(
          "flex max-w-[min(85%,42rem)] items-end gap-1.5",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border/80 bg-card shadow-xs"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <MarkdownContent content={text} />
          )}
        </div>

        {isUser && canEdit && onEdit ? (
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
