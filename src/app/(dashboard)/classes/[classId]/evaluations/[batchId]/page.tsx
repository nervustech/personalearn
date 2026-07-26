"use client";

import { use } from "react";
import { IdentityReviewPanel } from "@/components/classes/identity-review-panel";
import { ReviewQueuePanel } from "@/components/classes/review-queue-panel";
import { useClasses } from "@/lib/hooks/use-classes";

export default function EvaluationBatchReviewPage({
  params,
}: {
  params: Promise<{ classId: string; batchId: string }>;
}) {
  const { classId, batchId } = use(params);
  const { data: classes } = useClasses();
  const cls = classes?.find((c) => c.id === classId);

  return (
    <div className="mx-auto max-w-[90rem] space-y-4">
      <ReviewQueuePanel
        classId={classId}
        batchId={batchId}
        classLabel={cls?.name ?? "Class"}
        classSubject={cls?.subject ?? "General"}
      />
      <IdentityReviewPanel classId={classId} batchId={batchId} />
    </div>
  );
}
