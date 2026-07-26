"use client";

import Link from "next/link";
import { CompetencyStatusBadge } from "@/components/dashboard/competency-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AssessmentHealthBand } from "@/lib/evaluation/assessment-health";
import {
  buildStudentAssessmentHealthCubes,
  statusLabelForBand,
} from "@/lib/evaluation/assessment-health";
import {
  buildCompetencySnapshot,
  type SnapshotDisplayStatus,
  type StudentCompetencyRollup,
} from "@/lib/evaluation/competency-snapshot";
import type {
  Assessment,
  CompetencyProgress,
  Student,
  StudentSubmission,
} from "@/types/database";
import { cn } from "@/lib/utils";

const PULSE_ITEMS: {
  key: SnapshotDisplayStatus;
  label: string;
  className: string;
}[] = [
  { key: "mastered", label: "Mastered", className: "text-success" },
  { key: "developing", label: "Developing", className: "text-warning" },
  { key: "not_yet", label: "Not yet", className: "text-foreground" },
  {
    key: "no_evidence",
    label: "No evidence",
    className: "text-muted-foreground",
  },
];

const CUBE_COLOR: Record<AssessmentHealthBand, string> = {
  strong: "bg-primary",
  mixed: "bg-warning",
  weak: "bg-destructive",
  unsigned: "bg-muted-foreground/25",
};

function StrandBar({
  mastered,
  developing,
  not_yet,
  total,
}: {
  mastered: number;
  developing: number;
  not_yet: number;
  total: number;
}) {
  if (total <= 0) return null;
  const segments = [
    { key: "mastered", count: mastered, className: "bg-success" },
    { key: "developing", count: developing, className: "bg-warning" },
    { key: "not_yet", count: not_yet, className: "bg-muted-foreground/40" },
  ].filter((s) => s.count > 0);

  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${mastered} mastered, ${developing} developing, ${not_yet} not yet`}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={cn("h-full", segment.className)}
          style={{ width: `${(segment.count / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** Needs-attention first, then remaining roster A–Z. */
function orderStudentsForList(
  roster: StudentCompetencyRollup[],
  attention: StudentCompetencyRollup[]
): StudentCompetencyRollup[] {
  const attentionIds = new Set(attention.map((entry) => entry.student.id));
  const rest = roster
    .filter((entry) => !attentionIds.has(entry.student.id))
    .sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
  return [...attention, ...rest];
}

function StudentHealthCubes({
  classId,
  studentId,
  assessments,
  submissions,
}: {
  classId: string;
  studentId: string;
  assessments: Assessment[];
  submissions: StudentSubmission[];
}) {
  if (assessments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No assessments yet</p>
    );
  }

  const cubes = buildStudentAssessmentHealthCubes({
    assessments,
    submissions,
    studentId,
  });

  return (
    <div className="flex flex-wrap gap-1" role="list">
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
              "h-3 w-3 rounded-sm transition-opacity hover:opacity-80",
              CUBE_COLOR[cube.band]
            )}
          />
        );
      })}
    </div>
  );
}

export function CompetencySnapshot({
  classId,
  term,
  students,
  competency,
  assessments,
  submissions,
  isLoading,
}: {
  classId: string;
  term?: number;
  students: Student[];
  competency: CompetencyProgress[];
  assessments: Assessment[];
  submissions: StudentSubmission[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="space-y-3 rounded-xl bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          This class has no students yet. Add a roster on the class page to
          track competency after you sign off evaluations.
        </p>
        <Link
          href={`/classes/${classId}`}
          className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open class
        </Link>
      </div>
    );
  }

  const snapshot = buildCompetencySnapshot({ students, competency });
  const ordered = orderStudentsForList(snapshot.roster, snapshot.attention);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
      {/* Left: class summary */}
      <div className="space-y-5">
        {typeof term === "number" ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Term</span>
            <span className="font-medium">Term {term}</span>
          </div>
        ) : null}

        {!snapshot.hasEvidence ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Students enrolled</span>
              <span className="font-semibold">{students.length}</span>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              No signed-off evaluations yet — competency appears after you sign
              off scripts. Assessment health cubes stay grey until each student
              has signed-off results.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {PULSE_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      item.className
                    )}
                  >
                    {snapshot.pulse[item.key]}
                  </p>
                </div>
              ))}
            </div>

            {snapshot.strands.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Strands
                </p>
                <ul className="space-y-2.5">
                  {snapshot.strands.map((strand) => (
                    <li key={strand.strand} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{strand.strand}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {strand.total}
                        </span>
                      </div>
                      <StrandBar
                        mastered={strand.mastered}
                        developing={strand.developing}
                        not_yet={strand.not_yet}
                        total={strand.total}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden />
            {statusLabelForBand("strong")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-warning" aria-hidden />
            {statusLabelForBand("mixed")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-destructive" aria-hidden />
            {statusLabelForBand("weak")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm bg-muted-foreground/25"
              aria-hidden
            />
            {statusLabelForBand("unsigned")}
          </span>
        </div>
      </div>

      {/* Right: all students, needs-attention first, scrollable */}
      <div className="min-h-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Students
          </p>
          <Link
            href={`/classes/${classId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open class
          </Link>
        </div>
        <ul className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto pr-1">
          {ordered.map((entry) => (
            <li
              key={entry.student.id}
              className="space-y-2 rounded-xl border border-border px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <Link
                    href={`/classes/${classId}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {entry.student.full_name}
                  </Link>
                  {entry.student.admission_number ? (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {entry.student.admission_number}
                    </span>
                  ) : null}
                </div>
                <CompetencyStatusBadge status={entry.status} />
              </div>
              <StudentHealthCubes
                classId={classId}
                studentId={entry.student.id}
                assessments={assessments}
                submissions={submissions}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
