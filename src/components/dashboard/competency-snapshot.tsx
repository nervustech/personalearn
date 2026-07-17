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

const MOSAIC_COLOR: Record<SnapshotDisplayStatus, string> = {
  mastered: "bg-success",
  developing: "bg-warning",
  not_yet: "bg-muted-foreground/45",
  no_evidence: "bg-muted-foreground/20",
};

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
      <p className="text-sm text-muted-foreground">
        Add students to this class to track competency.
      </p>
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
          scripts.
        </div>
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
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Class mosaic
        </p>
        <div className="flex flex-wrap gap-1.5" role="list">
          {snapshot.roster.map((entry) => (
            <Link
              key={entry.student.id}
              href={`/classes/${classId}`}
              role="listitem"
              title={`${entry.student.full_name} — ${entry.status.replaceAll("_", " ")}`}
              aria-label={`${entry.student.full_name}, ${entry.status.replaceAll("_", " ")}`}
              className={cn(
                "h-3.5 w-3.5 rounded-sm transition-opacity hover:opacity-80",
                MOSAIC_COLOR[entry.status]
              )}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Needs attention
        </p>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All students
          </p>
          <Link
            href={`/classes/${classId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open class
          </Link>
        </div>
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {snapshot.roster.map((entry) => {
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
                  <p className="text-xs text-muted-foreground">
                    {entry.student.admission_number ?? "—"}
                    {hint ? ` · ${hint}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <CompetencyStatusBadge status={entry.status} />
                  {entry.strandCount > 1 ? (
                    <span className="text-xs text-muted-foreground">
                      +{entry.strandCount - 1}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
