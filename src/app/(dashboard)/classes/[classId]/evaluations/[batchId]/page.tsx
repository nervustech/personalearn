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
    <div className="mx-auto max-w-[90rem] space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={`/classes/${classId}`} className="hover:underline">
              ← Class
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Evaluation review
          </h1>
        </div>
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
