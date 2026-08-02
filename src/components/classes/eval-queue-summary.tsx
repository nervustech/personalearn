"use client";

import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  formatEvalQueueSummary,
  summarizeEvalQueue,
} from "@/lib/evaluation/queue-summary";

export function EvalQueueSummaryBar({
  scripts,
}: {
  scripts: ScriptReviewDto[];
}) {
  if (scripts.length === 0) return null;
  const summary = summarizeEvalQueue(scripts);
  return (
    <p className="text-xs text-muted-foreground">
      {formatEvalQueueSummary(summary)}
    </p>
  );
}
