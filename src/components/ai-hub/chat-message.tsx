"use client";

import type { UIMessage } from "ai";
import { Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getMessageText } from "@/lib/ai-hub/message-content";
import { cn } from "@/lib/utils";

type ChatMessageProps = {
  message: UIMessage;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const text = getMessageText(message);
  const isUser = message.role === "user";

  if (!text) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex gap-3",
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
          "max-w-[min(85%,42rem)] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border/80 bg-card shadow-xs"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <ReactMarkdown
            components={{
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
            }}
          >
            {text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
