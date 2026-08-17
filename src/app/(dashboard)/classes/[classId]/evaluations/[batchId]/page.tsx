"use client";

import { use, useEffect, useMemo } from "react";
import { IdentityReviewPanel } from "@/components/classes/identity-review-panel";
import { ReviewQueuePanel } from "@/components/classes/review-queue-panel";
import { useClasses } from "@/lib/hooks/use-classes";
import { useEvaluationScripts } from "@/lib/hooks/use-evaluation";

export default function EvaluationBatchReviewPage({
  params,
}: {
  params: Promise<{ classId: string; batchId: string }>;
}) {
  const { classId, batchId } = use(params);
  const { data: classes } = useClasses();
  const cls = classes?.find((c) => c.id === classId);
  const { data } = useEvaluationScripts(batchId);

  const needsIdentityPanel = useMemo(() => {
    const scripts = data?.scripts ?? [];
    return scripts.some(
      (s) =>
        s.status === "identity_amber" ||
        s.status === "unmatched" ||
        s.alreadyEvaluated
    );
  }, [data?.scripts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#identity-review") return;
    if (!needsIdentityPanel) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("identity-review")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [needsIdentityPanel, data?.scripts]);

  const queue = (
    <ReviewQueuePanel
      classId={classId}
      batchId={batchId}
      classLabel={cls?.name ?? "Class"}
      classSubject={cls?.subject ?? "General"}
    />
  );

  const identity = (
    <div id="identity-review" className="scroll-mt-6">
      <IdentityReviewPanel classId={classId} batchId={batchId} />
    </div>
  );

  return (
    <div className="mx-auto max-w-[90rem] space-y-4">
      {needsIdentityPanel ? (
        <>
          {identity}
          {queue}
        </>
      ) : (
        <>
          {queue}
          {identity}
        </>
      )}
    </div>
  );
}
