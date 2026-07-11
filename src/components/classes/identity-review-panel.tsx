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
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type IdentityReviewPanelProps = {
  classId: string;
  batchId: string;
};

type PreviewState = {
  index: number;
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
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const isAmber = script.status === "identity_amber";
  const isPending = script.status === "pending";

  const previewPage =
    preview != null ? script.pageUrls[preview.index] : undefined;
  const previewMeta =
    preview != null
      ? script.page_order.find(
          (p) => p.uploadIndex === script.pageUrls[preview.index]?.uploadIndex
        )
      : undefined;

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

      {script.hasByteDuplicate ? (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          Duplicate scan (same file stored once) — confirm identity before
          grading.
        </p>
      ) : null}

      {script.hasConflict && !script.hasByteDuplicate ? (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          Conflict: two pages share the same admission number and question
          number. Both pages are kept — confirm the correct student before
          grading.
        </p>
      ) : null}

      {script.hasConflict && script.hasByteDuplicate ? (
        <p className="text-sm text-muted-foreground">
          Both pages are kept in the script for review; only one copy is stored.
        </p>
      ) : null}

      {script.missingPageWarning ? (
        <p className="text-sm text-muted-foreground">
          Possible missing page (gap in question numbers). You can still
          proceed or upload an additional page later.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {script.pageUrls.map((page, index) => {
          const meta = script.page_order.find(
            (p) => p.uploadIndex === page.uploadIndex
          );
          return (
            <figure key={`${page.uploadIndex}-${page.storagePath}`} className="w-28 space-y-1">
              {page.url ? (
                <button
                  type="button"
                  className="block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setPreview({ index })}
                  aria-label={`Open full size: ${page.fileName}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.url}
                    alt={meta?.fileName ?? "Script page"}
                    className="h-36 w-28 object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-36 w-28 items-center justify-center bg-muted text-xs text-muted-foreground">
                  No preview
                </div>
              )}
              <figcaption className="text-xs text-muted-foreground">
                Q{(meta?.questionNumbers ?? []).join(",") || "?"}
                {meta?.conflict ? " · conflict" : ""}
                {meta?.duplicate ? " · duplicate" : ""}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <Dialog
        open={preview != null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={previewMeta?.fileName ?? previewPage?.fileName ?? "Page preview"}
        description={
          previewMeta
            ? `Q${(previewMeta.questionNumbers ?? []).join(",") || "?"} · page ${(preview?.index ?? 0) + 1} of ${script.pageUrls.length}`
            : undefined
        }
        className="max-h-[min(94vh,60rem)] max-w-4xl"
      >
        {previewPage?.url ? (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPage.url}
              alt={previewPage.fileName}
              className="mx-auto max-h-[min(70vh,48rem)] w-full object-contain"
            />
            {script.pageUrls.length > 1 ? (
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={preview == null || preview.index <= 0}
                  onClick={() =>
                    setPreview((p) =>
                      p && p.index > 0 ? { index: p.index - 1 } : p
                    )
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    preview == null ||
                    preview.index >= script.pageUrls.length - 1
                  }
                  onClick={() =>
                    setPreview((p) =>
                      p && p.index < script.pageUrls.length - 1
                        ? { index: p.index + 1 }
                        : p
                    )
                  }
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No preview available.</p>
        )}
      </Dialog>

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
            identity. Click a thumbnail for a full-size preview.
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
