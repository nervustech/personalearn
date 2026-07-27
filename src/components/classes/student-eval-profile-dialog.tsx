"use client";

import { useState } from "react";
import type { Student, StudentAssessmentStatus } from "@/types/database";
import { useStudentEvalProfile } from "@/lib/hooks/use-evaluation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StudentEvalProfileDialogProps = {
  classId: string;
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEvaluateAssessment: (assessmentId: string) => void;
  /** Open existing review when status is in_review. */
  onContinueReview?: (batchId: string) => void;
};

const STATUS_LABEL: Record<StudentAssessmentStatus, string> = {
  not_started: "Not started",
  in_review: "In review",
  signed_off: "Signed off",
};

function StatusBadge({ status }: { status: StudentAssessmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "signed_off" &&
          "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
        status === "in_review" &&
          "bg-amber-500/15 text-amber-950 dark:text-amber-100",
        status === "not_started" && "bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StudentEvalProfileDialog({
  classId,
  student,
  open,
  onOpenChange,
  onEvaluateAssessment,
  onContinueReview,
}: StudentEvalProfileDialogProps) {
  const studentId = student?.id;
  const { data, isLoading, error } = useStudentEvalProfile(
    open ? classId : undefined,
    open ? studentId : undefined
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const profileStudent = data?.student ?? student;
  const assessments = data?.assessments ?? [];

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setExpandedId(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={profileStudent?.full_name ?? "Student"}
      description="Assessments and evaluation status for this student."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {profileStudent ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Admission</dt>
              <dd className="font-medium">
                {profileStudent.admission_number ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="font-medium">{profileStudent.gender ?? "—"}</dd>
            </div>
          </dl>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Could not load assessments"}
          </p>
        ) : assessments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assessments for this class yet. Save a gradable resource from AI
            Hub or start a class evaluation to create one.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {assessments.map((row) => {
              const {
                assessment,
                status,
                markSummary,
                feedback,
                reviewBatchId,
              } = row;
              const isExpanded = expandedId === assessment.id;
              const markText =
                markSummary &&
                (markSummary.awarded != null || markSummary.max != null)
                  ? `${markSummary.awarded ?? "—"} / ${markSummary.max ?? "—"}`
                  : null;

              return (
                <li key={assessment.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">
                        {assessment.title}
                      </p>
                      {markText ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Score {markText}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {status === "signed_off" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : assessment.id)
                        }
                      >
                        {isExpanded ? "Hide feedback" : "View feedback"}
                      </Button>
                    ) : status === "in_review" &&
                      reviewBatchId &&
                      onContinueReview ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onContinueReview(reviewBatchId)}
                      >
                        Continue review
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onEvaluateAssessment(assessment.id)}
                      >
                        Evaluate / Upload work
                      </Button>
                    )}
                  </div>

                  {status === "signed_off" && isExpanded ? (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                      {feedback?.teacherFeedback ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Teacher feedback
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap">
                            {feedback.teacherFeedback}
                          </p>
                        </div>
                      ) : null}
                      {feedback?.aiFeedback ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            AI feedback
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap">
                            {feedback.aiFeedback}
                          </p>
                        </div>
                      ) : null}
                      {!feedback?.teacherFeedback && !feedback?.aiFeedback ? (
                        <p className="text-muted-foreground">
                          No written feedback stored for this submission.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
