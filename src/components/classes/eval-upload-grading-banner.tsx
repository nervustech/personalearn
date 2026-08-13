"use client";

import { EvalUploadProgressPanel } from "@/components/classes/eval-upload-progress";

type EvalUploadGradingBannerProps = {
  batchId: string;
};

/** Upload progress for the current eval session (grading start lives in the toolbar). */
export function EvalUploadGradingBanner({ batchId }: EvalUploadGradingBannerProps) {
  return <EvalUploadProgressPanel batchId={batchId} />;
}
