"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStudents } from "@/lib/hooks/use-classes";
import {
  useAssignEvaluationScript,
  useEvaluationScripts,
  useProcessDrafts,
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

function scriptStatusLabel(status: ScriptReviewDto["status"]) {
  switch (status) {
    case "pending":
      return "Pending processing";
    case "identity_amber":
      return "Needs confirm";
    case "identity_cleared":
      return "Identity cleared";
    case "drafted":
      return "Drafted";
    case "signed_off":
      return "Signed off";
    default:
      return status;
  }
}

function ScriptRow({
  classId,
  batchId,
  script,
  students,
  onIdentityCleared,
}: {
  classId: string;
  batchId: string;
  script: ScriptReviewDto;
  students: { id: string; full_name: string; admission_number: string | null }[];
  onIdentityCleared: () => void;
}) {
  const assign = useAssignEvaluationScript(classId, batchId);
  const [studentId, setStudentId] = useState(script.student_id ?? "");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const isAmber = script.status === "identity_amber";
  const isPending = script.status === "pending";
  const isDrafted = script.status === "drafted";

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
    const updated = await assign.mutateAsync({
      scriptId: script.id,
      studentId,
    });
    if (updated.status === "identity_cleared") {
      onIdentityCleared();
    }
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
                : isDrafted
                  ? "text-sm font-medium text-sky-800 dark:text-sky-200"
                  : "text-sm font-medium text-emerald-800 dark:text-emerald-200"
          }
        >
          {scriptStatusLabel(script.status)}
        </span>
      </div>

      {script.alreadyEvaluated ? (
        <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
          Already evaluated — this student already has an evaluation for this
          assessment. Do not draft again; open their existing review or
          signed-off feedback instead.
        </p>
      ) : null}

      {script.hasByteDuplicate ? (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          Duplicate scan (same file stored once) — confirm identity before
          grading.
        </p>
      ) : null}

      {script.hasConflict &&
      !script.hasByteDuplicate &&
      !script.alreadyEvaluated ? (
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
                {meta?.alreadyEvaluated ? " · already evaluated" : ""}
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

      {isAmber && !script.alreadyEvaluated ? (
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
  const processDrafts = useProcessDrafts(classId, batchId);
  const draftMutateAsync = processDrafts.mutateAsync;
  const [draftSummary, setDraftSummary] = useState<string | null>(null);

  const scripts = useMemo(() => data?.scripts ?? [], [data?.scripts]);
  const hasPending = scripts.some((s) => s.status === "pending");
  const amberCount = scripts.filter((s) => s.status === "identity_amber").length;
  const clearedCount = scripts.filter(
    (s) => s.status === "identity_cleared"
  ).length;
  const draftedCount = scripts.filter((s) => s.status === "drafted").length;
  const signedOffCount = scripts.filter((s) => s.status === "signed_off").length;

  const roster = useMemo(() => students ?? [], [students]);

  /** Only amber + pending need a visible panel; cleared drafts silently. */
  const identityFocusScripts = useMemo(() => {
    const priority = (status: string) => {
      if (status === "identity_amber") return 0;
      if (status === "pending") return 1;
      return 2;
    };
    return [...scripts]
      .filter(
        (s) => s.status === "identity_amber" || s.status === "pending"
      )
      .sort((a, b) => priority(a.status) - priority(b.status));
  }, [scripts]);

  const needsTeacherAttention = hasPending || amberCount > 0;

  const runDrafts = useCallback(async () => {
    setDraftSummary(null);
    const summary = await draftMutateAsync(batchId);
    await refetch();
    const errorNote =
      summary.errors.length > 0
        ? ` · ${summary.errors.length} error${summary.errors.length === 1 ? "" : "s"}`
        : "";
    setDraftSummary(
      `Drafted ${summary.drafted} script${summary.drafted === 1 ? "" : "s"}` +
        (summary.skippedAmber > 0
          ? ` · skipped ${summary.skippedAmber} amber`
          : "") +
        (summary.skippedAlreadyDrafted > 0
          ? ` · ${summary.skippedAlreadyDrafted} already drafted`
          : "") +
        errorNote +
        (summary.errors[0]
          ? ` — ${summary.errors[0].message}${
              summary.errors.length > 1 ? " (and more)" : ""
            }`
          : "")
    );
  }, [draftMutateAsync, batchId, refetch]);

  // Auto-draft cleared scripts on load so teachers never hand-trigger the
  // happy path. Each cleared id is attempted once; the Draft marks button
  // stays as an explicit retry if a run errors.
  const clearedIds = useMemo(
    () =>
      scripts.filter((s) => s.status === "identity_cleared").map((s) => s.id),
    [scripts]
  );
  const autoDraftedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (processIdentity.isPending || processDrafts.isPending) return;
    const toDraft = clearedIds.filter((id) => !autoDraftedRef.current.has(id));
    if (toDraft.length === 0) return;
    for (const id of toDraft) autoDraftedRef.current.add(id);
    void runDrafts();
  }, [clearedIds, processIdentity.isPending, processDrafts.isPending, runDrafts]);

  async function handleProcess() {
    const result = await processIdentity.mutateAsync(batchId);
    await refetch();
    if (result.some((s) => s.status === "identity_cleared")) {
      await runDrafts();
    }
  }

  async function handleDraftMarks() {
    await runDrafts();
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

  // Happy path: cleared scripts draft in the background; don't surface a
  // setup panel before review. Only interrupt when identity needs a human.
  if (!needsTeacherAttention && !processDrafts.isError) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-50/40 p-3 dark:bg-amber-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">
            {amberCount > 0
              ? `${amberCount} identity exception${amberCount === 1 ? "" : "s"}`
              : hasPending
                ? "Pages awaiting identity"
                : "Drafting issue"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {amberCount > 0
              ? "Confirm the student before marks can draft."
              : hasPending
                ? "Process identity to match admission numbers."
                : "Auto-draft failed — retry below."}
            {draftedCount + signedOffCount > 0
              ? ` · ${draftedCount + signedOffCount} already in review`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPending || scripts.length === 0 ? (
            <Button
              type="button"
              size="sm"
              disabled={processIdentity.isPending || processDrafts.isPending}
              onClick={handleProcess}
            >
              {processIdentity.isPending
                ? "Reading pages…"
                : "Process identity"}
            </Button>
          ) : null}
          {processDrafts.isError || clearedCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={processDrafts.isPending || processIdentity.isPending}
              onClick={handleDraftMarks}
            >
              {processDrafts.isPending ? "Retrying…" : "Retry draft"}
            </Button>
          ) : null}
        </div>
      </div>

      {processIdentity.isError ? (
        <p className="text-sm text-destructive">
          {processIdentity.error instanceof Error
            ? processIdentity.error.message
            : "Processing failed"}
        </p>
      ) : null}

      {processDrafts.isError ? (
        <p className="text-sm text-destructive">
          {processDrafts.error instanceof Error
            ? processDrafts.error.message
            : "Drafting failed"}
        </p>
      ) : null}

      {draftSummary ? (
        <p className="text-xs text-muted-foreground">{draftSummary}</p>
      ) : null}

      {scripts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pages uploaded yet.{" "}
          <Link href={`/classes/${classId}`} className="underline">
            Back to class
          </Link>
          .
        </p>
      ) : identityFocusScripts.length > 0 ? (
        <ul>
          {identityFocusScripts.map((script) => (
            <ScriptRow
              key={script.id}
              classId={classId}
              batchId={batchId}
              script={script}
              students={roster}
              onIdentityCleared={() => {
                void runDrafts();
              }}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
