"use client";

import { use } from "react";
import Link from "next/link";
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
  const classSubject =
    classes?.find((c) => c.id === classId)?.subject ?? "General";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/classes/${classId}`} className="hover:underline">
            ← Class
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Evaluation review
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review drafted marks beside the scan. Identity exceptions stay below —
          they are uncommon.
        </p>
      </div>
      <ReviewQueuePanel
        classId={classId}
        batchId={batchId}
        classSubject={classSubject}
      />
      <IdentityReviewPanel classId={classId} batchId={batchId} />
    </div>
  );
}
