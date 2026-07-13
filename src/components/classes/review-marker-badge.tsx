"use client";

import { cn } from "@/lib/utils";
import type { ReviewMarkerKind } from "@/lib/evaluation/page-images";
import type { QuestionEvaluationStatus } from "@/types/database";

const LABELS: Record<ReviewMarkerKind, string> = {
  correct: "✓",
  incorrect: "✗",
  partial: "~",
  unknown: "?",
};

export function ReviewMarkerBadge({
  kind,
  status,
  className,
}: {
  kind: ReviewMarkerKind;
  status?: QuestionEvaluationStatus;
  className?: string;
}) {
  const estimate = status === "ai_estimate";
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-base font-semibold shadow-sm",
        kind === "correct" &&
          !estimate &&
          "border-emerald-600/40 bg-emerald-50 text-emerald-800",
        kind === "incorrect" &&
          !estimate &&
          "border-red-600/40 bg-red-50 text-red-800",
        kind === "partial" &&
          !estimate &&
          "border-amber-600/40 bg-amber-50 text-amber-900",
        (kind === "unknown" || estimate) &&
          "border-amber-700/50 bg-amber-100 text-amber-950",
        className
      )}
      title={
        estimate
          ? `AI estimate · ${kind}`
          : kind === "correct"
            ? "Full marks"
            : kind === "incorrect"
              ? "No marks"
              : kind === "partial"
                ? "Partial marks"
                : "Marks unknown"
      }
    >
      {LABELS[kind]}
    </span>
  );
}
