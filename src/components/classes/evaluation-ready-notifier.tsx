"use client";

import { useEffect, useRef } from "react";
import { useEvaluationBatches } from "@/lib/hooks/use-evaluation";
import { useNotificationsStore } from "@/lib/store/notifications";
import type { EvaluationBatchStatus } from "@/types/database";

/**
 * F4: When a batch leaves processing for drafted/in_review, notify with a deep-link.
 * Mounted on the class page so teachers can keep working elsewhere in that class.
 */
export function EvaluationReadyNotifier({ classId }: { classId: string }) {
  const { data: batches } = useEvaluationBatches(classId);
  const add = useNotificationsStore((s) => s.add);
  const prevStatus = useRef<Map<string, EvaluationBatchStatus>>(new Map());

  useEffect(() => {
    if (!batches) return;

    for (const batch of batches) {
      const prev = prevStatus.current.get(batch.id);
      prevStatus.current.set(batch.id, batch.status);

      if (!prev) continue;
      const becameReady =
        prev === "processing" &&
        (batch.status === "drafted" || batch.status === "in_review");
      if (!becameReady) continue;

      add({
        title: "Review ready",
        body: "Draft marks are ready — open the evaluation review when you are free.",
        href: `/classes/${classId}/evaluations/${batch.id}`,
      });
    }
  }, [batches, classId, add]);

  return null;
}
