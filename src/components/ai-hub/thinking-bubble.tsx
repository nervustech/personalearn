"use client";

import { Sparkles } from "lucide-react";

export function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
          </span>
          Thinking…
        </div>
      </div>
    </div>
  );
}
