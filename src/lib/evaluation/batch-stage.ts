import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  formatEvalQueueSummary,
  summarizeEvalQueue,
} from "@/lib/evaluation/queue-summary";
import type { EvaluationBatchStatus } from "@/types/database";

export type TeacherBatchStage = {
  label: string;
  summary: string | null;
  cta: string;
};

function pagesSummary(pageCount: number): string {
  return `${pageCount} page${pageCount === 1 ? "" : "s"} uploaded`;
}

/**
 * Teacher-facing stage for an open evaluation session.
 * Pipeline: Upload → Ready → Identity/Duplicates → Grading → Review → Done.
 */
export function deriveTeacherBatchStage(
  scripts: ScriptReviewDto[],
  batchStatus: EvaluationBatchStatus,
  pageCount = 0
): TeacherBatchStage {
  if (scripts.length === 0) {
    if (pageCount > 0) {
      return {
        label: "Ready",
        summary: `${pagesSummary(pageCount)} — start grading when ready`,
        cta: "Continue evaluation",
      };
    }
    return {
      label: "Upload",
      summary: "No scans uploaded yet",
      cta: "Upload scans",
    };
  }

  const summary = summarizeEvalQueue(scripts);
  const summaryText = formatEvalQueueSummary(summary);

  if (summary.identity > 0) {
    return {
      label: "Identity",
      summary: summaryText,
      cta: "Confirm identity",
    };
  }

  if (summary.blocked > 0) {
    return {
      label: "Duplicates",
      summary: summaryText,
      cta: "Resolve duplicates",
    };
  }

  if (summary.grading > 0) {
    return {
      label: "Grading",
      summary: summaryText,
      cta: "View progress",
    };
  }

  if (summary.ready > 0) {
    return {
      label: "Review",
      summary: summaryText,
      cta: "Open review",
    };
  }

  if (batchStatus === "signed_off" || summary.done === scripts.length) {
    return {
      label: "Done",
      summary: summaryText,
      cta: "View session",
    };
  }

  return {
    label: "Ready",
    summary: summaryText ?? pagesSummary(Math.max(pageCount, scripts.length)),
    cta: "Continue evaluation",
  };
}

export function isOpenEvaluationBatchStatus(
  status: EvaluationBatchStatus
): boolean {
  return status !== "signed_off";
}
