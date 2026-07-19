"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { AssessmentHealthBand } from "@/lib/evaluation/assessment-health";
import { buildAssessmentHealthCubes } from "@/lib/evaluation/assessment-health";
import type { Assessment, StudentSubmission } from "@/types/database";
import { cn } from "@/lib/utils";

const CUBE_COLOR: Record<AssessmentHealthBand, string> = {
  strong: "bg-primary",
  mixed: "bg-warning",
  weak: "bg-destructive",
  unsigned: "bg-muted-foreground/25",
};

export function AssessmentHealthStrip({
  classId,
  assessments,
  submissions,
  isLoading,
}: {
  classId: string;
  assessments: Assessment[];
  submissions: StudentSubmission[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assessment health
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-3.5 w-3.5 rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assessment health
        </p>
        <p className="text-sm text-muted-foreground">
          No assessments yet. Upload a quiz or exam on the class page to start
          evaluating.
        </p>
      </div>
    );
  }

  const cubes = buildAssessmentHealthCubes({ assessments, submissions });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Assessment health
      </p>
      <div className="flex flex-wrap gap-1.5" role="list">
        {cubes.map((cube) => {
          const title = `${cube.assessment.title} — ${cube.statusLabel}`;
          return (
            <Link
              key={cube.assessment.id}
              href={`/classes/${classId}?assessment=${cube.assessment.id}`}
              role="listitem"
              title={title}
              aria-label={title}
              className={cn(
                "h-3.5 w-3.5 rounded-sm transition-opacity hover:opacity-80",
                CUBE_COLOR[cube.band]
              )}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden />
          Strong
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-warning" aria-hidden />
          Mixed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-destructive" aria-hidden />
          Weak
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm bg-muted-foreground/25"
            aria-hidden
          />
          Unsigned
        </span>
      </div>
    </div>
  );
}
