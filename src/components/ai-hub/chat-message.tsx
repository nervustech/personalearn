"use client";

import type { UIMessage } from "ai";
import { Pencil, Sparkles, User } from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getMessageText } from "@/lib/ai-hub/message-content";
import { normalizeMarkdown } from "@/lib/ai-hub/normalize-markdown";
import { cn } from "@/lib/utils";

type ChatMessageProps = {
  message: UIMessage;
  canEdit?: boolean;
  onEdit?: (messageId: string, text: string) => void;
};

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/80">
      <table className="w-full min-w-[16rem] border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-2 align-top leading-relaxed">
      {children}
    </td>
  ),
  tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {normalizeMarkdown(text)}
            </ReactMarkdown>
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
