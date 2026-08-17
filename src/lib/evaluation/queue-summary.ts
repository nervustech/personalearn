import type { ScriptReviewDto } from "@/lib/evaluation/identity";

export type EvalQueueSummary = {
  ready: number;
  grading: number;
  identity: number;
  blocked: number;
  done: number;
};

export function summarizeEvalQueue(
  scripts: ScriptReviewDto[]
): EvalQueueSummary {
  const summary: EvalQueueSummary = {
    ready: 0,
    grading: 0,
    identity: 0,
    blocked: 0,
    done: 0,
  };

  for (const script of scripts) {
    switch (script.status) {
      case "ready":
      case "drafted":
        summary.ready += 1;
        break;
      case "signed_off":
        summary.done += 1;
        break;
      case "identity_amber":
      case "unmatched":
        if (script.alreadyEvaluated) {
          summary.blocked += 1;
        } else {
          summary.identity += 1;
        }
        break;
      case "pending":
      case "uploaded":
        if (script.alreadyEvaluated) {
          summary.blocked += 1;
        }
        break;
      case "indexing":
      case "evaluating":
      case "parsing":
      case "queued_draft":
      case "drafting":
      case "identity_cleared":
        summary.grading += 1;
        break;
      case "failed":
        summary.blocked += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

export function formatEvalQueueSummary(summary: EvalQueueSummary): string {
  const parts = [
    `${summary.ready} ready`,
    `${summary.grading} grading`,
    `${summary.identity} need identity`,
    summary.blocked > 0 ? `${summary.blocked} blocked` : null,
    `${summary.done} done`,
  ].filter(Boolean);
  return parts.join(" · ");
}
