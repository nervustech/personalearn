"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import {
  useAssessments,
  useEvaluationBatches,
} from "@/lib/hooks/use-evaluation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EvaluationBatch, EvaluationBatchStatus } from "@/types/database";

type ClassAssessmentsSectionProps = {
  classId: string;
};

function isReviewReady(status: EvaluationBatchStatus) {
  return status === "drafted" || status === "in_review";
}

function batchStatusLabel(status: EvaluationBatchStatus) {
  switch (status) {
    case "processing":
      return "Grading…";
    case "drafted":
    case "in_review":
      return "Review ready";
    case "signed_off":
      return "Signed off";
    default:
      return "Draft";
  }
}

export function ClassAssessmentsSection({
  classId,
}: ClassAssessmentsSectionProps) {
  const { data: assessments, isLoading: assessmentsLoading } =
    useAssessments(classId);
  const { data: batches, isLoading: batchesLoading } =
    useEvaluationBatches(classId);

  const isLoading = assessmentsLoading || batchesLoading;

  const reviewBatches = (batches ?? []).filter((b) =>
    isReviewReady(b.status)
  );
  const processingBatches = (batches ?? []).filter(
    (b) => b.status === "processing"
  );

  const titleByAssessmentId = new Map(
    (assessments ?? []).map((a) => [a.id, a.title])
  );

  function batchTitle(batch: EvaluationBatch) {
    if (batch.assessment_id) {
      return titleByAssessmentId.get(batch.assessment_id) ?? "Assessment";
    }
    return "Evaluation batch";
  }

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-lg">Assessments</CardTitle>
        {reviewBatches.length > 0 ? (
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:text-emerald-100">
            {reviewBatches.length} review ready
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (assessments ?? []).length === 0 && (batches ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assessments yet. Save a gradable resource from AI Hub or start an
            evaluation.
          </p>
        ) : (
          <>
            {processingBatches.length > 0 ? (
              <ul className="space-y-2">
                {processingBatches.map((batch) => (
                  <li
                    key={batch.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{batchTitle(batch)}</p>
                      <p className="text-xs text-muted-foreground">
                        {batchStatusLabel(batch.status)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {reviewBatches.length > 0 ? (
              <ul className="space-y-2">
                {reviewBatches.map((batch) => (
                  <li
                    key={batch.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {batchTitle(batch)}
                      </p>
                      <p className="text-xs text-emerald-900 dark:text-emerald-100">
                        Review ready
                      </p>
                    </div>
                    <Link
                      href={`/classes/${classId}/evaluations/${batch.id}`}
                      className={cn(buttonVariants({ size: "sm" }))}
                    >
                      <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                      Open review
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {(assessments ?? []).length > 0 ? (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {(assessments ?? []).slice(0, 8).map((assessment) => {
                  const related = (batches ?? []).filter(
                    (b) => b.assessment_id === assessment.id
                  );
                  const ready = related.find((b) => isReviewReady(b.status));
                  const processing = related.find(
                    (b) => b.status === "processing"
                  );
                  return (
                    <li
                      key={assessment.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {assessment.title}
                        </p>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground",
                            ready && "text-emerald-800 dark:text-emerald-200"
                          )}
                        >
                          {ready
                            ? "Review ready"
                            : processing
                              ? "Grading…"
                              : related.length
                                ? batchStatusLabel(related[0]!.status)
                                : "Not started"}
                        </p>
                      </div>
                      {ready ? (
                        <Link
                          href={`/classes/${classId}/evaluations/${ready.id}`}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "secondary" })
                          )}
                        >
                          Review
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
