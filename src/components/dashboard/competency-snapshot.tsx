"use client";

import Link from "next/link";
import { CompetencyStatusBadge } from "@/components/dashboard/competency-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildCompetencySnapshot,
  type SnapshotDisplayStatus,
  type StudentCompetencyRollup,
} from "@/lib/evaluation/competency-snapshot";
import type { CompetencyProgress, Student } from "@/types/database";
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

function evidenceHint(entry: StudentCompetencyRollup) {
  if (entry.status === "no_evidence") return null;
  const parts: string[] = [];
  if (entry.evidenceCount > 0) {
    parts.push(
      `${entry.evidenceCount} evidence${entry.evidenceCount === 1 ? "" : "s"}`
    );
  }
  if (entry.strandCount > 1) {
    parts.push(`${entry.strandCount} strands`);
  }
  return parts.length ? parts.join(" · ") : null;
}

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

export function CompetencySnapshot({
  classId,
  students,
  competency,
  isLoading,
}: {
  classId: string;
  students: Student[];
  competency: CompetencyProgress[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
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

  if (!snapshot.hasEvidence) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Students enrolled</span>
          <span className="font-semibold">{students.length}</span>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          No signed-off evaluations yet — competency appears after you sign off
          scripts. Start an evaluation from the class page.
        </div>
        <Link
          href={`/classes/${classId}`}
          className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-xs font-medium hover:bg-muted"
        >
          Go to class
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PULSE_ITEMS.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-border px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn("text-xl font-semibold tabular-nums", item.className)}>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Needs attention
          </p>
          <Link
            href={`/classes/${classId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open class
          </Link>
        </div>
        {snapshot.attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No students currently need attention on competency.
          </p>
        ) : (
          <ul className="space-y-2">
            {snapshot.attention.map((entry) => {
              const hint = evidenceHint(entry);
              return (
                <li
                  key={entry.student.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/classes/${classId}`}
                      className="font-medium hover:underline"
                    >
                      {entry.student.full_name}
                    </Link>
                    {hint ? (
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    ) : null}
                  </div>
                  <CompetencyStatusBadge status={entry.status} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
