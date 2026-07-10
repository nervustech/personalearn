"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStudents } from "@/lib/hooks/use-classes";
import {
  useAssignEvaluationScript,
  useEvaluationScripts,
  useProcessEvaluationIdentity,
} from "@/lib/hooks/use-evaluation";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type IdentityReviewPanelProps = {
  classId: string;
  batchId: string;
};

function ScriptRow({
  classId,
  batchId,
  script,
  students,
}: {
  classId: string;
  batchId: string;
  script: ScriptReviewDto;
  students: { id: string; full_name: string; admission_number: string | null }[];
}) {
  const assign = useAssignEvaluationScript(classId, batchId);
  const [studentId, setStudentId] = useState(script.student_id ?? "");
  const isAmber = script.status === "identity_amber";
  const isPending = script.status === "pending";

  async function handleAssign() {
    if (!studentId) return;
    await assign.mutateAsync({ scriptId: script.id, studentId });
  }

  return (
    <li className="space-y-3 border-b border-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {script.student_name ?? "Unmatched"}
            {script.read_admission_number
              ? ` · ${script.read_admission_number}`
              : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {script.page_order.length} page
            {script.page_order.length === 1 ? "" : "s"}
            {script.match_confidence
              ? ` · confidence ${script.match_confidence}`
              : ""}
          </p>
        </div>
        <span
          className={
            isAmber
              ? "text-sm font-medium text-amber-800 dark:text-amber-200"
              : isPending
                ? "text-sm text-muted-foreground"
                : "text-sm font-medium text-emerald-800 dark:text-emerald-200"
          }
        >
          {isPending
            ? "Pending processing"
            : isAmber
              ? "Needs confirm"
              : "Identity cleared"}
        </span>
      </div>

      {script.hasConflict ? (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          Conflict: two pages share the same admission number and question
          number. Both pages are kept — confirm the correct student before
          grading.
        </p>
      ) : null}

      {script.missingPageWarning ? (
        <p className="text-sm text-muted-foreground">
          Possible missing page (gap in question numbers). You can still
          proceed or upload an additional page later.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {script.pageUrls.map((page) => {
          const meta = script.page_order.find(
            (p) => p.storagePath === page.storagePath
          );
          return (
            <figure key={page.storagePath} className="w-28 space-y-1">
              {page.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.url}
                  alt={meta?.fileName ?? "Script page"}
                  className="h-36 w-28 object-cover"
                />
              ) : (
                <div className="flex h-36 w-28 items-center justify-center bg-muted text-xs text-muted-foreground">
                  No preview
                </div>
              )}
              <figcaption className="text-xs text-muted-foreground">
                Q{(meta?.questionNumbers ?? []).join(",") || "?"}
                {meta?.conflict ? " · conflict" : ""}
              </figcaption>
            </figure>
          );
        })}
      </div>

      {isAmber ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor={`assign-${script.id}`}>Assign student</Label>
            <Select
              id={`assign-${script.id}`}
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={assign.isPending}
            >
              <option value="">Select from roster…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.admission_number ? ` (${s.admission_number})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!studentId || assign.isPending}
            onClick={handleAssign}
          >
            {assign.isPending ? "Saving…" : "Confirm"}
          </Button>
          {assign.isError ? (
            <p className="w-full text-sm text-destructive">
              {assign.error instanceof Error
                ? assign.error.message
                : "Assign failed"}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function IdentityReviewPanel({
  classId,
  batchId,
}: IdentityReviewPanelProps) {
  const { data, isLoading, error, refetch } = useEvaluationScripts(batchId);
  const { data: students } = useStudents(classId);
  const processIdentity = useProcessEvaluationIdentity(classId);

  const scripts = data?.scripts ?? [];
  const hasPending = scripts.some((s) => s.status === "pending");
  const amberCount = scripts.filter((s) => s.status === "identity_amber").length;
  const clearedCount = scripts.filter(
    (s) => s.status === "identity_cleared"
  ).length;

  const roster = useMemo(() => students ?? [], [students]);

  async function handleProcess() {
    await processIdentity.mutateAsync(batchId);
    await refetch();
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load scripts"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Confirm who each script belongs to before grading. Cleared:{" "}
            {clearedCount} · Needs confirm: {amberCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-question drafts arrive in a later step — this screen only fixes
            identity.
          </p>
        </div>
        {hasPending || scripts.length === 0 ? (
          <Button
            type="button"
            disabled={processIdentity.isPending}
            onClick={handleProcess}
          >
            {processIdentity.isPending
              ? "Reading pages…"
              : "Process identity"}
          </Button>
        ) : null}
      </div>

      {processIdentity.isError ? (
        <p className="text-sm text-destructive">
          {processIdentity.error instanceof Error
            ? processIdentity.error.message
            : "Processing failed"}
        </p>
      ) : null}

      {scripts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pages uploaded yet.{" "}
          <Link href={`/classes/${classId}`} className="underline">
            Back to class
          </Link>{" "}
          to start an evaluation upload.
        </p>
      ) : (
        <ul className="divide-y-0">
          {scripts.map((script) => (
            <ScriptRow
              key={script.id}
              classId={classId}
              batchId={batchId}
              script={script}
              students={roster}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
