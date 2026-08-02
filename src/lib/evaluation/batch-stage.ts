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

/** Teacher-facing stage for an open evaluation session. */
export function deriveTeacherBatchStage(
  scripts: ScriptReviewDto[],
  batchStatus: EvaluationBatchStatus
): TeacherBatchStage {
  if (scripts.length === 0) {
    return {
      label: "Upload",
      summary: "No scans uploaded yet",
      cta: "Continue upload",
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
      label: "Duplicate",
      summary: summaryText,
      cta: "Resolve duplicates",
    };
  }

  if (summary.grading > 0) {
    return {
      label: "Grading",
      summary: summaryText,
      cta: "Open session",
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
    label: "Setup",
    summary: summaryText,
    cta: "Open session",
  };
}

export function isOpenEvaluationBatchStatus(
  status: EvaluationBatchStatus
): boolean {
  return status !== "signed_off";
}
