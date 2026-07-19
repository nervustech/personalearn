"use client";

import { use } from "react";
import Link from "next/link";
import { IdentityReviewPanel } from "@/components/classes/identity-review-panel";
import { ReviewQueuePanel } from "@/components/classes/review-queue-panel";
import { useClasses } from "@/lib/hooks/use-classes";

/**
 * Deep-linkable split-pane review (F8).
 * Optional ?scriptId= focuses a student script in the workspace.
 */
export default function EvaluationBatchReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string; batchId: string }>;
  searchParams: Promise<{ scriptId?: string }>;
}) {
  const { classId, batchId } = use(params);
  const { scriptId } = use(searchParams);
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            Split-pane workspace — submission on the left, analysis on the right.
          </p>
        </div>
      </div>
      <ReviewQueuePanel
        classId={classId}
        batchId={batchId}
        classSubject={classSubject}
        initialScriptId={scriptId}
      />
      <IdentityReviewPanel classId={classId} batchId={batchId} />
    </div>
  );
}
