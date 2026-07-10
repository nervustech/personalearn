"use client";

import { use } from "react";
import Link from "next/link";
import { IdentityReviewPanel } from "@/components/classes/identity-review-panel";

export default function EvaluationBatchIdentityPage({
  params,
}: {
  params: Promise<{ classId: string; batchId: string }>;
}) {
  const { classId, batchId } = use(params);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/classes/${classId}`} className="hover:underline">
            ← Class
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Identity review
        </h1>
      </div>
      <IdentityReviewPanel classId={classId} batchId={batchId} />
    </div>
  );
}
