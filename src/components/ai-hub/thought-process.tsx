"use client";

import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ThoughtProcessProps = {
  reasoning: string;
  isStreaming?: boolean;
  hasResponseContent?: boolean;
};

export function ThoughtProcess({
  reasoning,
  isStreaming = false,
  hasResponseContent = false,
}: ThoughtProcessProps) {
  const isActivelyThinking = isStreaming && !hasResponseContent;
  const [isOpen, setIsOpen] = useState(true);
  const wasThinkingRef = useRef(false);

  // Automatically collapse when thinking transitions to response streaming, but allow user to reopen
  useEffect(() => {
    if (isActivelyThinking) {
      wasThinkingRef.current = true;
      setIsOpen(true);
    } else if (wasThinkingRef.current && hasResponseContent) {
      wasThinkingRef.current = false;
      setIsOpen(false);
    }
  }, [isActivelyThinking, hasResponseContent]);

  if (!reasoning.trim()) {
    return null;
  }

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border/70 bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-primary",
              isActivelyThinking && "animate-pulse text-primary"
            )}
          />
          <span>
            {isActivelyThinking ? "Thinking…" : "Thought process"}
          </span>
          {isActivelyThinking ? (
            <span className="inline-flex gap-0.5 ml-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary" />
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground/80">
          <span>{isOpen ? "Hide" : "Show"}</span>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-border/60 px-3 py-2.5 text-muted-foreground font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto bg-background/50">
          {reasoning}
        </div>
      ) : null}
    </div>
  );
}
